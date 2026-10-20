import React, { useId } from 'react';

// interface: 단원 셀렉터 컴포넌트 속성 //
interface Props<T> {
    title: string;
    options: T[];
    selectedItem: T | null;
    getOptionName: (option: T) => string;
    getOptionValue: (option: T) => number;
    placeholder: string;
    disabled?: boolean;
    onOptionClickHanlder: (value: T) => void;
}

// component: 단원 및 회차 셀렉터 컴포넌트 //
export default function UnitSelector<T>(props: Props<T>) {

    // variable: 셀렉터 속성 구조 분해 //
    const { title, options, selectedItem, getOptionName, getOptionValue, placeholder, disabled, onOptionClickHanlder } = props;

    // variable: 셀렉터와 레이블을 연결하는 고유 아이디 //
    const selectorId = useId();

    // event handler: 셀렉터 선택 이벤트 처리 //
    const onSelectorChangeHandler = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOption = options.find(option => String(getOptionValue(option)) === event.target.value);
        if (selectedOption) onOptionClickHanlder(selectedOption);
    };

    // render: 단원 및 회차 셀렉터 컴포넌트 렌더링 //
    return (
        <div className='unit-box'>
            <label className='field-label' htmlFor={selectorId}>{title}</label>
            <select
                id={selectorId}
                className={`unit-select${selectedItem === null ? ' is-placeholder' : ''}`}
                value={selectedItem === null ? '' : getOptionValue(selectedItem)}
                onChange={onSelectorChangeHandler}
                disabled={disabled || options.length === 0}
                required
            >
                <option value='' disabled>{placeholder}</option>
                {options.map(option => (
                    <option key={getOptionValue(option)} value={getOptionValue(option)}>
                        {getOptionName(option)}
                    </option>
                ))}
            </select>
        </div>
    );
}
