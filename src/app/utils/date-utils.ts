// 날짜 관련 유틸리티 함수들

// 해당 월의 일수 구하기
export function getDaysInMonth(year: number, month: number): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

// 공휴일 감지 함수
export function isHoliday(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  
  // 주말은 공휴일로 간주
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }
  
  // 한국의 주요 공휴일들
  const holidays = [
    { month: 1, day: 1 },   // 신정
    { month: 3, day: 1 },   // 삼일절
    { month: 5, day: 5 },   // 어린이날
    { month: 6, day: 6 },   // 현충일
    { month: 8, day: 15 },  // 광복절
    { month: 10, day: 3 },  // 개천절
    { month: 10, day: 9 },  // 한글날
    { month: 12, day: 25 }, // 성탄절
  ];
  
  // 고정 공휴일 체크
  for (const holiday of holidays) {
    if (month === holiday.month && day === holiday.day) {
      return true;
    }
  }
  
  return false;
}
