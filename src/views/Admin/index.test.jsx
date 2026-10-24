const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const React = require('react');
const { MemoryRouter } = require('react-router');
const { render, screen, fireEvent, waitFor, within, act } = require('@testing-library/react');
require('@testing-library/jest-dom');
const App = require('../../App').default;
const { useAuthStore } = require('../../stores');
const { postAdminQuestionsRequest, getAdminCheckRequest } = require('../../apis');

jest.mock('../../stores', () => ({ useAuthStore: jest.fn() }));
jest.mock('react-cookie', () => ({ useCookies: () => [{}] }));
jest.mock('../../apis', () => ({ logoutRequest: jest.fn(), refreshAccessTokenRequest: jest.fn(), postAdminQuestionsRequest: jest.fn(), getAdminCheckRequest: jest.fn() }));
jest.mock('../Auth', () => () => <div>로그인 화면</div>);
jest.mock('../Main', () => () => <div>메인 화면</div>);
jest.mock('../MyPage', () => () => <div>마이페이지 화면</div>);
jest.mock('../Test/Exam', () => () => <div>시험 화면</div>);
jest.mock('../Test/Grade', () => () => <div>채점 화면</div>);

const question = { sectionId: 4, questionType: '모의고사', difficulty: '중', questionText: '원래 문제', option1: '보기 하나', option2: '보기 둘', option3: '보기 셋', option4: '보기 넷', answer: 1, tags: '35,36' };
const jsonFile = (questions, raw) => {
  const text = raw ?? JSON.stringify({ questions });
  const file = new File([text], 'questions.json', { type: 'application/json' });
  file.text = () => Promise.resolve(text);
  return file;
};
const open = async () => {
  const view = render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: '문제 업로드', level: 1 });
  return view;
};
const selectJson = async (questions) => {
  fireEvent.drop(screen.getByRole('button', { name: /JSON 파일을 드래그/ }), { dataTransfer: { files: [jsonFile(questions)] } });
  await screen.findByRole('heading', { name: '1번 문제' });
};
const card = (number = 1) => within(screen.getByRole('heading', { name: `${number}번 문제` }).closest('article'));
const change = (label, value, number = 1) => fireEvent.change(card(number).getByLabelText(label), { target: { value } });

beforeEach(() => {
  jest.clearAllMocks();
  getAdminCheckRequest.mockResolvedValue(200);
  useAuthStore.mockReturnValue({ accessToken: 'test-token', setAccessToken: jest.fn(), clearAuth: jest.fn() });
  URL.createObjectURL = jest.fn(file => `blob:${file.name}`);
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

test('drops JSON and multiple images without saving; edits live preview and submits latest DTO once', async () => {
  await open();
  await selectJson([{
    ...question, imageFileName: 'question.png', detailedExplanation: { content: '원래 해설', imageFileName: 'explanation.jpg' }
  }, { ...question, questionType: '기출문제', tags: null, pastExamRound: 7, questionOrder: 2 }]);
  const images = [new File(['png'], 'question.png', { type: 'image/png' }), new File(['jpg'], 'explanation.jpg', { type: 'image/jpeg' })];
  fireEvent.drop(screen.getByRole('button', { name: /이미지 파일을 여러 개/ }), { dataTransfer: { files: images } });
  expect(screen.getByAltText('1번 문제 이미지')).toHaveAttribute('src', 'blob:question.png');
  expect(screen.getByAltText('1번 상세 해설 이미지')).toHaveAttribute('src', 'blob:explanation.jpg');
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
  change(/문제 지문/, '수정한 문제');
  change('선택지 2', '수정한 정답');
  change('정답 번호', '2');
  change('섹션 ID', '9');
  change('난이도', '상');
  change('간단 해설', '수정한 간단 해설');
  change('상세 해설 내용', '수정한 상세 해설');
  change('모의고사 기출 회차 태그', '35,36,37');
  change('기출 회차', '8', 2);
  change('기출문제 순서', '3', 2);
  const preview = within(screen.getByRole('region', { name: '1번 문제 미리보기' }));
  expect(preview.getByRole('heading', { name: '수정한 문제' })).toBeInTheDocument();
  expect(preview.getByText('수정한 정답').closest('li')).toHaveClass('is-correct');
  fireEvent.submit(screen.getByRole('button', { name: '문제 등록' }).closest('form'));
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
  let resolve;
  postAdminQuestionsRequest.mockImplementation(() => new Promise(done => { resolve = done; }));
  const submit = screen.getByRole('button', { name: '문제 등록' });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(postAdminQuestionsRequest).toHaveBeenCalledTimes(1);
  const [body, sentImages, token] = postAdminQuestionsRequest.mock.calls[0];
  expect(body.questions[0]).toMatchObject({ sectionId: 9, questionText: '수정한 문제', option2: '수정한 정답', answer: 2, difficulty: '상', tags: '35,36,37', detailedExplanation: { content: '수정한 상세 해설', imageFileName: 'explanation.jpg' } });
  expect(body.questions[0]).not.toHaveProperty('key');
  expect(body.questions[1]).toMatchObject({ pastExamRound: 8, questionOrder: 3, tags: null });
  expect(sentImages).toEqual(images);
  expect(token).toBe('test-token');
  expect(screen.getByRole('button', { name: '등록 중…' })).toBeDisabled();
  await act(async () => resolve({ code: 'SU', message: 'Success.' }));
  expect(screen.getByRole('status')).toHaveTextContent('문제 등록이 완료되었습니다.');
  expect(card().getByLabelText('섹션 ID')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '새 등록 시작' }));
  expect(screen.queryByRole('heading', { name: '1번 문제' })).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:question.png');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:explanation.jpg');
});

test('missing image blocks registration; duplicate names rejected; confirmed deletion clears references', async () => {
  await open();
  await selectJson([{ ...question, imageFileName: 'missing.png', detailedExplanation: { content: '해설', imageFileName: 'missing.png' } }]);
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  expect(screen.getByRole('alert')).toHaveTextContent('1번 문제');
  expect(screen.getByRole('alert')).toHaveTextContent('파일이 없습니다: missing.png');
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
  const image = new File(['image'], 'missing.png', { type: 'image/png' });
  const input = screen.getByLabelText('이미지 파일 선택');
  fireEvent.change(input, { target: { files: [image] } });
  fireEvent.change(input, { target: { files: [image] } });
  expect(screen.getByRole('alert')).toHaveTextContent('중복된 이미지 파일명');
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'missing.png 제거' }));
  expect(screen.getByAltText('1번 문제 이미지')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'missing.png 제거' }));
  expect(card().getByLabelText('문제 이미지')).toHaveValue('');
  expect(card().getByLabelText('상세 해설 이미지')).toHaveValue('');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:missing.png');
  postAdminQuestionsRequest.mockResolvedValue({ code: 'SU', message: 'Success.' });
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  await screen.findByRole('status');
  expect(postAdminQuestionsRequest.mock.calls[0][0].questions[0].imageFileName).toBeNull();
  expect(postAdminQuestionsRequest.mock.calls[0][1]).toEqual([]);
});

test('file picker supports no-image JSON; malformed replacement and server failure preserve edits and selected files', async () => {
  const { unmount } = await open();
  fireEvent.change(screen.getByLabelText('JSON 파일 선택'), { target: { files: [jsonFile([question])] } });
  await screen.findByRole('heading', { name: '1번 문제' });
  change(/문제 지문/, '실패해도 유지');
  fireEvent.change(screen.getByLabelText('JSON 파일 선택'), { target: { files: [jsonFile([], '{bad')] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('JSON 문법');
  expect(card().getByLabelText(/문제 지문/)).toHaveValue('실패해도 유지');
  const image = new File(['image'], 'unused.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('이미지 파일 선택'), { target: { files: [image] } });
  postAdminQuestionsRequest.mockResolvedValue({ code: 'ISE', message: 'Server error.' });
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error.'));
  expect(card().getByLabelText(/문제 지문/)).toHaveValue('실패해도 유지');
  expect(screen.getByRole('button', { name: 'unused.png 제거' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '문제 등록' })).toBeEnabled();
  postAdminQuestionsRequest.mockResolvedValue(null);
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('서버 응답을 확인하지 못했습니다.'));
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:unused.png');
});

test('type editing and filters retain every question; validation covers hidden cards', async () => {
  await open();
  await selectJson([question, question, question, { ...question, questionType: '기출문제', tags: null }]);
  expect(card(4).getByRole('button', { name: '펼치기' })).toBeInTheDocument();
  change('문제 유형', '기출문제');
  expect(card().getByLabelText('기출 회차')).toHaveValue(null);
  change('기출 회차', '5');
  change('기출문제 순서', '1');
  fireEvent.click(screen.getByRole('button', { name: '모의고사', pressed: false }));
  expect(screen.queryByRole('heading', { name: '1번 문제' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  expect(screen.getByRole('alert')).toHaveTextContent('4번 문제');
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '전체', pressed: false }));
  expect(card(4).getByLabelText('기출 회차')).toBeInTheDocument();
});

test('admin route preserves login redirect and hides administrator content before login', async () => {
  useAuthStore.mockReturnValue({ accessToken: null, setAccessToken: jest.fn(), clearAuth: jest.fn() });
  render(<MemoryRouter initialEntries={['/admin/upload']}><App /></MemoryRouter>);
  await screen.findByText('로그인 화면');
  expect(screen.queryByRole('heading', { name: '문제 업로드' })).not.toBeInTheDocument();
});


test('legacy JSON prompts for an actual round and submits the edited numeric round without internal ID', async () => {
  await open();
  await selectJson([{ ...question, questionType: '기출문제', tags: null, pastExamId: 123, questionOrder: 5 }]);
  expect(card().getByLabelText('기출 회차')).toHaveValue(null);
  expect(card().getByText(/기출 회차\(pastExamRound\)를 입력해주세요/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('pastExamRound');
  change('기출 회차', '39');
  expect(card().getByLabelText('기출 회차')).toHaveValue(39);
  expect(card().getByText('기출 회차: 39회 · 문항 순서: 5')).toBeInTheDocument();
  postAdminQuestionsRequest.mockResolvedValue({ code: 'SU', message: 'Success.' });
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  await screen.findByRole('status');
  expect(postAdminQuestionsRequest.mock.calls[0][0].questions[0]).toMatchObject({ pastExamRound: 39, questionOrder: 5 });
  expect(postAdminQuestionsRequest.mock.calls[0][0].questions[0]).not.toHaveProperty('pastExamId');
});


test('images added while JSON is still being read are connected when parsing completes', async () => {
  await open();
  let finishRead;
  const file = jsonFile([{ ...question, imageFileName: 'question.png' }]);
  file.text = () => new Promise(resolve => { finishRead = resolve; });
  fireEvent.change(screen.getByLabelText('JSON 파일 선택'), { target: { files: [file] } });
  const image = new File(['png'], 'question.png', { type: 'image/png' });
  fireEvent.drop(screen.getByRole('button', { name: /이미지 파일을 여러 개/ }), { dataTransfer: { files: [image] } });
  await act(async () => finishRead(JSON.stringify({ questions: [{ ...question, imageFileName: 'question.png' }] })));
  expect(await screen.findByAltText('1번 문제 이미지')).toHaveAttribute('src', 'blob:question.png');
  expect(postAdminQuestionsRequest).not.toHaveBeenCalled();
});

test('JSON then Korean image files updates both previews and sends actual uploaded filenames', async () => {
  await open();
  const filename = '문제.png'.normalize('NFD');
  const detailName = '해설.png'.normalize('NFD');
  await selectJson([{ ...question, imageFileName: '문제.png', detailedExplanation: { content: '설명', imageFileName: '해설.png' } }]);
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  expect(screen.getByRole('alert')).toHaveTextContent('파일이 없습니다');
  const images = [new File(['png'], filename, { type: 'image/png' }), new File(['png'], detailName, { type: 'image/png' })];
  fireEvent.change(screen.getByLabelText('이미지 파일 선택'), { target: { files: images } });
  expect(await screen.findByAltText('1번 문제 이미지')).toHaveAttribute('src', `blob:${filename}`);
  expect(screen.getByAltText('1번 상세 해설 이미지')).toHaveAttribute('src', `blob:${detailName}`);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(card().getByLabelText('문제 이미지')).toHaveValue(filename);
  expect(card().getByLabelText('상세 해설 이미지')).toHaveValue(detailName);
  postAdminQuestionsRequest.mockResolvedValue({ code: 'SU', message: 'Success.' });
  fireEvent.click(screen.getByRole('button', { name: '문제 등록' }));
  await screen.findByRole('status');
  const [body, files] = postAdminQuestionsRequest.mock.calls[0];
  expect(body.questions[0].imageFileName).toBe(files[0].name);
  expect(body.questions[0].detailedExplanation.imageFileName).toBe(files[1].name);
});


test('images selected before JSON bind correctly and deleting a bound image clears both references', async () => {
  await open();
  const filename = '그림.png'.normalize('NFD');
  fireEvent.change(screen.getByLabelText('이미지 파일 선택'), { target: { files: [new File(['png'], filename, { type: 'image/png' })] } });
  await selectJson([{ ...question, imageFileName: '그림.png', detailedExplanation: { content: '해설', imageFileName: '그림.png' } }]);
  expect(screen.getByAltText('1번 문제 이미지')).toHaveAttribute('src', `blob:${filename}`);
  expect(screen.getByAltText('1번 상세 해설 이미지')).toHaveAttribute('src', `blob:${filename}`);
  fireEvent.click(screen.getByRole('button', { name: `${filename} 제거` }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('1번 문제'));
  expect(card().getByLabelText('문제 이미지')).toHaveValue('');
  expect(card().getByLabelText('상세 해설 이미지')).toHaveValue('');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:${filename}`);
});
