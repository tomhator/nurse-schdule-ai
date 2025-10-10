'use server';

// 간호사 관련 액션들

// 간호사 데이터 타입 정의
export interface Nurse {
  id: number;
  name: string;
  remainingOff: number;
  remainingVacation: number;
  usedVacation: number;
}

// 간호사 목록 불러오기
export async function getNurses(): Promise<Nurse[]> {
  try {
    // 실제 구현에서는 데이터베이스에서 불러오기
    return [
      { id: 1, name: '김간호', remainingOff: 0, remainingVacation: 0, usedVacation: 0 },
      { id: 2, name: '이간호', remainingOff: 0, remainingVacation: 0, usedVacation: 0 },
      { id: 3, name: '박간호', remainingOff: 0, remainingVacation: 0, usedVacation: 0 },
      { id: 4, name: '최간호', remainingOff: 0, remainingVacation: 0, usedVacation: 0 },
      { id: 5, name: '정간호', remainingOff: 0, remainingVacation: 0, usedVacation: 0 }
    ];
  } catch (error) {
    return [];
  }
}

// 간호사 추가
export async function addNurse(nurseData: Omit<Nurse, 'id'>) {
  try {
    // 실제 구현에서는 데이터베이스에 저장
    return { success: true, message: '간호사가 추가되었습니다.' };
  } catch (error) {
    return { success: false, message: '간호사 추가에 실패했습니다.' };
  }
}

// 간호사 수정
export async function updateNurse(id: number, nurseData: Partial<Nurse>) {
  try {
    // 실제 구현에서는 데이터베이스 업데이트
    return { success: true, message: '간호사 정보가 수정되었습니다.' };
  } catch (error) {
    return { success: false, message: '간호사 수정에 실패했습니다.' };
  }
}

// 간호사 삭제
export async function deleteNurse(id: number) {
  try {
    // 실제 구현에서는 데이터베이스에서 삭제
    return { success: true, message: '간호사가 삭제되었습니다.' };
  } catch (error) {
    return { success: false, message: '간호사 삭제에 실패했습니다.' };
  }
}

// 간호사 연차 정보 업데이트
export async function updateNurseVacation(id: number, vacationData: {
  remainingOff?: number;
  remainingVacation?: number;
  usedVacation?: number;
}) {
  try {
    // 실제 구현에서는 데이터베이스 업데이트
    return { success: true, message: '연차 정보가 업데이트되었습니다.' };
  } catch (error) {
    return { success: false, message: '연차 정보 업데이트에 실패했습니다.' };
  }
}
