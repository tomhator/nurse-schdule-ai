// 클라이언트 사이드 함수들

// 인원 설정 관련 액션들

// 직급 데이터 타입
export interface Position {
  id: string;
  name: string;
}

// 근무 유형 데이터 타입
export interface WorkType {
  id: string;
  name: string;
  color: string;
}

// 인원 설정 데이터 타입
export interface StaffingData {
  [key: string]: number;
}

// 직급 목록 불러오기 (클라이언트 사이드)
export function getPositions(): Position[] {
  return [
    { id: 'HN', name: 'HN (수간호사)' },
    { id: 'RN', name: 'RN (간호사)' },
    { id: 'AN', name: 'AN (간호조무사)' }
  ];
}

// 근무 유형 목록 불러오기 (클라이언트 사이드)
export function getWorkTypes(): WorkType[] {
  return [
    { id: 'D', name: 'D (주간)', color: 'text-blue-600' },
    { id: 'E', name: 'E (저녁)', color: 'text-orange-600' },
    { id: 'N', name: 'N (야간)', color: 'text-purple-600' },
    { id: 'M', name: 'M (오전)', color: 'text-green-600' }
  ];
}

// 인원 설정 저장 (클라이언트 사이드)
export function saveStaffingData(data: StaffingData): { success: boolean; message: string } {
  try {
    localStorage.setItem('staffing_data', JSON.stringify(data));
    return { success: true, message: '인원 설정이 저장되었습니다.' };
  } catch (error) {
    return { success: false, message: '인원 설정 저장에 실패했습니다.' };
  }
}

// 인원 설정 불러오기 (클라이언트 사이드)
export function loadStaffingData(): StaffingData {
  try {
    const savedData = localStorage.getItem('staffing_data');
    if (savedData) {
      return JSON.parse(savedData);
    }
    return {};
  } catch (error) {
    return {};
  }
}

// 인원 설정 초기화 (클라이언트 사이드)
export function resetStaffingData(): { success: boolean; message: string } {
  try {
    localStorage.removeItem('staffing_data');
    return { success: true, message: '인원 설정이 초기화되었습니다.' };
  } catch (error) {
    return { success: false, message: '인원 설정 초기화에 실패했습니다.' };
  }
}

// 특정 직급-근무유형별 인원 수 업데이트 (클라이언트 사이드)
export function updateStaffingCount(positionId: string, workTypeId: string, count: number): { success: boolean; message: string } {
  try {
    const key = `${positionId}_${workTypeId}`;
    const currentData = loadStaffingData();
    currentData[key] = count;
    saveStaffingData(currentData);
    return { success: true, message: '인원 수가 업데이트되었습니다.' };
  } catch (error) {
    return { success: false, message: '인원 수 업데이트에 실패했습니다.' };
  }
}

// 총 인원 수 계산 (클라이언트 사이드)
export function calculateTotalStaffing(staffingData: StaffingData): number {
  let total = 0;
  Object.values(staffingData).forEach((count: any) => {
    if (typeof count === 'number' && !count.toString().startsWith('_')) {
      total += count;
    }
  });
  return total;
}

// 총 인원 수와 함께 저장 (클라이언트 사이드)
export function saveStaffingWithTotal(staffingData: StaffingData): { success: boolean; message: string } {
  try {
    // _totalStaffing을 제외한 순수한 데이터만 추출
    const cleanData = Object.fromEntries(
      Object.entries(staffingData).filter(([key]) => key !== '_totalStaffing')
    );
    
    const totalStaffing = calculateTotalStaffing(cleanData);
    
    // 기존 데이터에 총 인원 수 추가
    const dataWithTotal = {
      ...cleanData,
      _totalStaffing: totalStaffing
    };
    
    localStorage.setItem('staffing_data', JSON.stringify(dataWithTotal));
    return { success: true, message: `인원 설정이 저장되었습니다. (총 ${totalStaffing}명)` };
  } catch (error) {
    return { success: false, message: '인원 설정 저장에 실패했습니다.' };
  }
}

// 총 인원 수 불러오기 (클라이언트 사이드)
export function getTotalStaffing(): number {
  try {
    const savedData = localStorage.getItem('staffing_data');
    if (savedData) {
      const data = JSON.parse(savedData);
      return data._totalStaffing || 0;
    }
  } catch (error) {
    console.error('총 인원 수를 불러오는데 실패했습니다:', error);
  }
  return 0;
}