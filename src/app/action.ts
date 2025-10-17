'use server';

// 스케줄 관련 액션들

// 스케줄 데이터 타입 정의
export interface ScheduleData {
  [year: number]: {
    [month: number]: {
      [key: string]: string;
    };
  };
}

// 스케줄 저장
export async function saveSchedule(year: number, month: number) {
  try {
    // 실제 구현에서는 데이터베이스에 저장
    // 여기서는 로컬 스토리지 시뮬레이션
    return { success: true, message: `${year}년 ${month}월 스케줄이 저장되었습니다.` };
  } catch {
    return { success: false, message: '스케줄 저장에 실패했습니다.' };
  }
}

// 스케줄 불러오기
export async function loadSchedule() {
  try {
    // 실제 구현에서는 데이터베이스에서 불러오기
    return { success: true, data: {} };
  } catch {
    return { success: false, data: {} };
  }
}

// 스케줄 초기화
export async function resetSchedule(year: number, month: number) {
  try {
    // 실제 구현에서는 데이터베이스에서 삭제
    return { success: true, message: `${year}년 ${month}월 스케줄이 초기화되었습니다.` };
  } catch {
    return { success: false, message: '스케줄 초기화에 실패했습니다.' };
  }
}

// 최소 휴무일 계산
export function calculateMinDaysOff(year: number, month: number, weekendHolidayDays: number[]) {
  return weekendHolidayDays.length;
}

// 각 간호사의 O(휴무) 개수 계산
export function calculateNurseOffDays(nurseId: number, scheduleData: {[key: string]: string}, daysInMonth: number[]) {
  let offCount = 0;
  
  daysInMonth.forEach(day => {
    const key = `${nurseId}-${day}`;
    if (scheduleData[key] === 'O') {
      offCount++;
    }
  });
  
  return offCount;
}

// 각 간호사의 남은 off 개수 계산
export function calculateRemainingOff(nurseId: number, minDaysOff: number, scheduleData: {[key: string]: string}, daysInMonth: number[]) {
  const usedOffDays = calculateNurseOffDays(nurseId, scheduleData, daysInMonth);
  return Math.max(0, minDaysOff - usedOffDays);
}
