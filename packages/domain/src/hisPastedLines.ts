/**
 * HIS 관리화면에서 그대로 복사하면(셀이 tab 이 아니라 줄바꿈으로 구분되어,
 * 한 셀당 한 줄씩 이어지는 형태) 만들어지는 붙여넣기 텍스트를 표 형태(CellMatrix)로 복원한다.
 *
 * 예약 1건은 다음 순서의 줄로 시작한다:
 *   NO / Group Code / (예약번호, 선택) / CHK-IN / CHK-OUT / 단체명 / 인원 / Bed Type
 * 그 뒤로 이어지는 일자별 재실 내역(날짜/TWN/SGL/Status/예약번호/금액 등) 중 첫 밤의
 * Status(비고, '캔슬'/'변경 ...' 등)만 뽑아내고, 나머지는 정규화에 쓰이지 않으므로
 * 다음 예약(NO + Group Code 패턴)이 나올 때까지 건너뛴다.
 *
 * 이 형태로 보이지 않으면 null 을 반환하여 호출부가 기존 방식(탭 구분 등)으로 처리하게 한다.
 */

import type { CellValue } from './types';
import type { CellMatrix } from './sheetMapping';

const NO_LINE_RE = /^\d+$/;
const GROUP_CODE_RE = /^[A-Za-z]\d{6,10}-\d{2,5}$/;
const DATE_LINE_RE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/;
const COUNT_LINE_RE = /^\d+$/;
const AMOUNT_LINE_RE = /^[\d,]+$/;
// 예약번호 자리에 오는 '3/20 OK' 같은 승인일 메모(정규화에는 쓰이지 않음)
const APPROVAL_NOTE_RE = /^\d{1,2}\/\d{1,2}\s*OK$/i;

function isRecordStart(lines: string[], idx: number): boolean {
  return NO_LINE_RE.test(lines[idx] ?? '') && GROUP_CODE_RE.test(lines[idx + 1] ?? '');
}

export function reconstructHisCellLines(text: string): CellMatrix | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const startIndex = lines.findIndex((_, idx) => isRecordStart(lines, idx));
  if (startIndex === -1) return null;

  const header: CellValue[] = [
    'NO',
    'Group Code',
    '예약번호',
    'CHK-IN',
    'CHK-OUT',
    '단체명',
    '인원',
    'Bed Type',
    'Bed Type2',
    '열3',
    'Status',
  ];
  const rows: CellMatrix = [header];

  let i = startIndex;
  while (i < lines.length) {
    if (!isRecordStart(lines, i)) {
      i += 1;
      continue;
    }
    const no = lines[i];
    const groupCode = lines[i + 1];
    let cursor = i + 2;

    let 예약번호: string | null = null;
    if (cursor < lines.length && !DATE_LINE_RE.test(lines[cursor])) {
      예약번호 = lines[cursor];
      cursor += 1;
    }
    if (!DATE_LINE_RE.test(lines[cursor] ?? '')) return null;
    const chkIn = lines[cursor];
    cursor += 1;
    if (!DATE_LINE_RE.test(lines[cursor] ?? '')) return null;
    const chkOut = lines[cursor];
    cursor += 1;
    if (cursor >= lines.length) return null;
    const 단체명 = lines[cursor];
    cursor += 1;
    if (cursor >= lines.length) return null;
    const 인원 = lines[cursor];
    cursor += 1;
    if (cursor >= lines.length) return null;
    // 방타입이 여러 개(예: '1TWN' 다음 줄에 '1DBL')로 잡힌 경우를 모두 담는다.
    // 일자별 재실 내역(날짜로 시작)이 나오기 전까지는 전부 방타입으로 본다.
    const bedTypeParts: string[] = [];
    while (
      cursor < lines.length &&
      !DATE_LINE_RE.test(lines[cursor]) &&
      !isRecordStart(lines, cursor)
    ) {
      bedTypeParts.push(lines[cursor]);
      cursor += 1;
    }
    if (bedTypeParts.length === 0) return null;
    const [bedType, bedType2 = null, bedType3 = null] = bedTypeParts;

    // 첫 밤(날짜/TWN/SGL) 뒤에 Status(비고, '캔슬'/'변경 ...' 등 여러 줄일 수 있음)가 이어진다.
    // 예약번호(예: '3/20 OK')나 금액(예: '55,000')이 나오면 Status 는 끝난 것으로 본다.
    let status: string | null = null;
    if (cursor < lines.length && DATE_LINE_RE.test(lines[cursor])) {
      let statusCursor = cursor + 1; // 날짜
      if (COUNT_LINE_RE.test(lines[statusCursor] ?? '')) statusCursor += 1; // TWN
      if (COUNT_LINE_RE.test(lines[statusCursor] ?? '')) statusCursor += 1; // SGL
      const statusParts: string[] = [];
      while (
        statusCursor < lines.length &&
        !AMOUNT_LINE_RE.test(lines[statusCursor]) &&
        !APPROVAL_NOTE_RE.test(lines[statusCursor]) &&
        !DATE_LINE_RE.test(lines[statusCursor]) &&
        !isRecordStart(lines, statusCursor)
      ) {
        statusParts.push(lines[statusCursor]);
        statusCursor += 1;
      }
      if (statusParts.length > 0) status = statusParts.join(' ');
    }

    rows.push([
      no,
      groupCode,
      예약번호,
      chkIn,
      chkOut,
      단체명,
      인원,
      bedType,
      bedType2,
      bedType3,
      status,
    ]);

    // 다음 예약이 나올 때까지 일자별 재실 내역(날짜/TWN/SGL/비고/금액 등)을 건너뛴다.
    let next = cursor;
    while (next < lines.length && !isRecordStart(lines, next)) {
      next += 1;
    }
    i = next;
  }

  return rows.length > 1 ? rows : null;
}
