/**
 * 한진 관리화면 표를 복사하면, 같은 Tour(단체)의 추가 객실/동반자 이름이
 * no./Tour-No/Period/Nights 값 없이 별도 줄로 붙는 경우가 있다(병합 셀이
 * 앞쪽 빈 칸을 남기지 않고 그대로 생략됨). 이 상태로 일반 표 파싱을 하면
 * 열 위치가 밀려 엉뚱한 값이 Tour-No 등으로 잘못 매핑될 수 있다.
 *
 * 이 모듈은 실제 예약 행(no. 로 시작하고 Tour-No 형식의 값을 포함하는 줄)과
 * 헤더 줄만 남기고, 그 사이에 낀 동반자/추가 객실 줄은 제거한다.
 * (정규화 단계에서 Tour-No 가 비어 있는 행은 어차피 제거되므로, 결과에는 영향이 없다.)
 */

const TOUR_NO_HEADER_RE = /^tour[\s-]?no\.?$/i;
const TOUR_NO_VALUE_RE = /^[A-Za-z]{1,4}-\d{8,}-[A-Za-z0-9]{1,5}$/;
const NO_TOKEN_RE = /^\d+$/;

function tokenize(line: string): string[] {
  return line
    .trim()
    .split(/\t+| {2,}/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function isHeaderLine(tokens: string[]): boolean {
  return tokens.some((t) => TOUR_NO_HEADER_RE.test(t));
}

function isMasterLine(tokens: string[]): boolean {
  return tokens.length >= 2 && NO_TOKEN_RE.test(tokens[0]) && TOUR_NO_VALUE_RE.test(tokens[1]);
}

/**
 * 헤더 줄과 실제 예약(master) 줄만 남긴 텍스트를 돌려준다.
 * 예약 줄을 하나도 찾지 못하면 null(호출부가 기존 방식으로 처리).
 */
export function filterHanjinPastedLines(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let hasMasterLine = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const tokens = tokenize(trimmed);
    if (isHeaderLine(tokens)) {
      kept.push(line);
      continue;
    }
    if (isMasterLine(tokens)) {
      kept.push(line);
      hasMasterLine = true;
    }
  }

  return hasMasterLine ? kept.join('\n') : null;
}
