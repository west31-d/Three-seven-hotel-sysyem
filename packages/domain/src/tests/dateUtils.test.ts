import { describe, it, expect } from 'vitest';
import {
  formatDateOnly,
  excelSerialToDateOnly,
  parseDateOnly,
  parseDateResult,
  parseBsPeriod,
  parseHanjinPeriod,
  sameDate,
  addDaysDateOnly,
  normalizeHeader,
} from '../dateUtils';

describe('dateUtils', () => {
  it('Excel serial 을 날짜로 변환 (1899-12-30 기준)', () => {
    // 46203 = 2026-06-30
    expect(excelSerialToDateOnly(46203)).toBe('2026-06-30');
    // epoch 가 1899-12-30 이므로 serial 2 = 1900-01-01
    expect(excelSerialToDateOnly(2)).toBe('1900-01-01');
  });

  it('parseDateOnly 은 문자열/시리얼/ISO 를 처리', () => {
    expect(parseDateOnly('2026-07-02', 2026)).toBe('2026-07-02');
    expect(parseDateOnly(46203, 2026)).toBe('2026-06-30');
    expect(parseDateOnly('2026-06-26 00:00:00', 2026)).toBe('2026-06-26');
  });

  it('parseDateOnly 은 연도 없는 MM/DD 에 referenceYear 적용', () => {
    expect(parseDateOnly('06/30', 2026)).toBe('2026-06-30');
    expect(parseDateOnly('7/2', 2026)).toBe('2026-07-02');
    // 자동 연도 보정 없음: 체크아웃이 체크인보다 앞서도 그대로
    expect(parseDateOnly('01/02', 2026)).toBe('2026-01-02');
  });

  it('parseDateResult 는 빈 값/정상/오류를 구분', () => {
    expect(parseDateResult('', 2026).kind).toBe('empty');
    expect(parseDateResult(null, 2026).kind).toBe('empty');
    expect(parseDateResult('2026-07-02', 2026).kind).toBe('ok');
    expect(parseDateResult('not-a-date', 2026).kind).toBe('invalid');
  });

  it('parseBsPeriod 는 ~ 로 분리하고 트림 ([체크인, 체크아웃])', () => {
    expect(parseBsPeriod('06/30~07/02', 2026)).toEqual([
      '2026-06-30',
      '2026-07-02',
    ]);
    expect(parseBsPeriod(' 06/30 ~ 07/02 ', 2026)).toEqual([
      '2026-06-30',
      '2026-07-02',
    ]);
  });

  it('parseHanjinPeriod 는 공백을 허용하는 ~ 로 분리 ([체크인, 체크아웃])', () => {
    expect(parseHanjinPeriod('2026-06-26 ~ 2026-06-28', 2026)).toEqual([
      '2026-06-26',
      '2026-06-28',
    ]);
    expect(parseHanjinPeriod('2026-06-26~2026-06-28', 2026)).toEqual([
      '2026-06-26',
      '2026-06-28',
    ]);
  });

  it('sameDate 는 문자열 동등 비교, null 은 false', () => {
    expect(sameDate('2026-07-10', '2026-07-10')).toBe(true);
    expect(sameDate('2026-07-10', '2026-07-11')).toBe(false);
    expect(sameDate(null, '2026-07-10')).toBe(false);
  });

  it('addDaysDateOnly 는 UTC 기준으로 일 가감', () => {
    expect(addDaysDateOnly('2026-07-10', 1)).toBe('2026-07-11');
    expect(addDaysDateOnly('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDaysDateOnly('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formatDateOnly 는 UTC 구성요소 사용', () => {
    expect(formatDateOnly(new Date(Date.UTC(2026, 6, 2)))).toBe('2026-07-02');
  });

  it('normalizeHeader 는 nbsp 를 공백으로, 공백을 축약', () => {
    expect(normalizeHeader('요청\u00A0사항')).toBe('요청 사항');
    expect(normalizeHeader('  CHK-IN  ')).toBe('CHK-IN');
  });
});
