// 클라이언트 사이드 함수들

// 간호사 정보 타입 정의
export interface Nurse {
  id: number;
  name: string;
  position: 'HN' | 'RN' | 'AN';
  weekendWork: boolean;
  workAvailability: {
    D: boolean; // 주간
    E: boolean; // 저녁
    N: boolean; // 야간
    M: boolean; // 오전
  };
  nightDedicated: boolean; // 야간전담근무자
  remainingVacation: number; // 잔여 연차
  usedVacation: number; // 사용 연차
}

// 간호사 목록 불러오기 (클라이언트 사이드)
export function getNurses(): Nurse[] {
  try {
    const savedData = localStorage.getItem('nurses_data');
    if (savedData) {
      return JSON.parse(savedData);
    }
    
    // 기본 간호사 데이터
    const defaultNurses: Nurse[] = [
      {
        id: 1,
        name: '김간호',
        position: 'RN',
        weekendWork: true,
        workAvailability: { D: true, E: true, N: false, M: true },
        nightDedicated: false,
        remainingVacation: 15,
        usedVacation: 0
      },
      {
        id: 2,
        name: '이간호',
        position: 'RN',
        weekendWork: true,
        workAvailability: { D: true, E: true, N: true, M: true },
        nightDedicated: false,
        remainingVacation: 12,
        usedVacation: 0
      },
      {
        id: 3,
        name: '박간호',
        position: 'AN',
        weekendWork: false,
        workAvailability: { D: true, E: false, N: false, M: true },
        nightDedicated: false,
        remainingVacation: 10,
        usedVacation: 0
      },
      {
        id: 4,
        name: '최간호',
        position: 'HN',
        weekendWork: true,
        workAvailability: { D: true, E: true, N: false, M: true },
        nightDedicated: false,
        remainingVacation: 20,
        usedVacation: 0
      },
      {
        id: 5,
        name: '정간호',
        position: 'RN',
        weekendWork: true,
        workAvailability: { D: false, E: true, N: true, M: false },
        nightDedicated: true,
        remainingVacation: 8,
        usedVacation: 0
      }
    ];
    
    return defaultNurses;
  } catch (error) {
    console.error('간호사 목록을 불러오는데 실패했습니다:', error);
    return [];
  }
}

// 간호사 추가 (클라이언트 사이드)
export function addNurse(nurseData: Omit<Nurse, 'id'>): { success: boolean; message: string; nurse?: Nurse } {
  try {
    const savedData = localStorage.getItem('nurses_data');
    let nurses: Nurse[] = [];
    
    if (savedData) {
      nurses = JSON.parse(savedData);
    } else {
      // 기본 간호사 데이터
      nurses = [
        {
          id: 1,
          name: '김간호',
          position: 'RN',
          weekendWork: true,
          workAvailability: { D: true, E: true, N: false, M: true },
          nightDedicated: false,
          remainingVacation: 15,
          usedVacation: 0
        },
        {
          id: 2,
          name: '이간호',
          position: 'RN',
          weekendWork: true,
          workAvailability: { D: true, E: true, N: true, M: true },
          nightDedicated: false,
          remainingVacation: 12,
          usedVacation: 0
        },
        {
          id: 3,
          name: '박간호',
          position: 'AN',
          weekendWork: false,
          workAvailability: { D: true, E: false, N: false, M: true },
          nightDedicated: false,
          remainingVacation: 10,
          usedVacation: 0
        },
        {
          id: 4,
          name: '최간호',
          position: 'HN',
          weekendWork: true,
          workAvailability: { D: true, E: true, N: false, M: true },
          nightDedicated: false,
          remainingVacation: 20,
          usedVacation: 0
        },
        {
          id: 5,
          name: '정간호',
          position: 'RN',
          weekendWork: true,
          workAvailability: { D: false, E: true, N: true, M: false },
          nightDedicated: true,
          remainingVacation: 8,
          usedVacation: 0
        }
      ];
    }
    
    const newId = Math.max(...nurses.map(n => n.id), 0) + 1;
    
    const newNurse: Nurse = {
      id: newId,
      ...nurseData
    };
    
    const updatedNurses = [...nurses, newNurse];
    localStorage.setItem('nurses_data', JSON.stringify(updatedNurses));
    
    return { 
      success: true, 
      message: '간호사가 추가되었습니다.', 
      nurse: newNurse 
    };
  } catch (error) {
    return { success: false, message: '간호사 추가에 실패했습니다.' };
  }
}

// 간호사 수정 (클라이언트 사이드)
export function updateNurse(id: number, nurseData: Partial<Omit<Nurse, 'id'>>): { success: boolean; message: string } {
  try {
    const savedData = localStorage.getItem('nurses_data');
    if (!savedData) {
      return { success: false, message: '간호사 데이터를 찾을 수 없습니다.' };
    }
    
    const nurses: Nurse[] = JSON.parse(savedData);
    const nurseIndex = nurses.findIndex(n => n.id === id);
    
    if (nurseIndex === -1) {
      return { success: false, message: '간호사를 찾을 수 없습니다.' };
    }
    
    nurses[nurseIndex] = { ...nurses[nurseIndex], ...nurseData };
    localStorage.setItem('nurses_data', JSON.stringify(nurses));
    
    return { success: true, message: '간호사 정보가 수정되었습니다.' };
  } catch (error) {
    return { success: false, message: '간호사 수정에 실패했습니다.' };
  }
}

// 간호사 삭제 (클라이언트 사이드)
export function deleteNurse(id: number): { success: boolean; message: string } {
  try {
    const savedData = localStorage.getItem('nurses_data');
    if (!savedData) {
      return { success: false, message: '간호사 데이터를 찾을 수 없습니다.' };
    }
    
    const nurses: Nurse[] = JSON.parse(savedData);
    const filteredNurses = nurses.filter(n => n.id !== id);
    
    if (nurses.length === filteredNurses.length) {
      return { success: false, message: '간호사를 찾을 수 없습니다.' };
    }
    
    localStorage.setItem('nurses_data', JSON.stringify(filteredNurses));
    
    return { success: true, message: '간호사가 삭제되었습니다.' };
  } catch (error) {
    return { success: false, message: '간호사 삭제에 실패했습니다.' };
  }
}

// 간호사 연차 업데이트 (클라이언트 사이드)
export function updateNurseVacation(id: number, remainingVacation: number, usedVacation: number): { success: boolean; message: string } {
  try {
    const savedData = localStorage.getItem('nurses_data');
    if (!savedData) {
      return { success: false, message: '간호사 데이터를 찾을 수 없습니다.' };
    }
    
    const nurses: Nurse[] = JSON.parse(savedData);
    const nurseIndex = nurses.findIndex(n => n.id === id);
    
    if (nurseIndex === -1) {
      return { success: false, message: '간호사를 찾을 수 없습니다.' };
    }
    
    nurses[nurseIndex].remainingVacation = remainingVacation;
    nurses[nurseIndex].usedVacation = usedVacation;
    localStorage.setItem('nurses_data', JSON.stringify(nurses));
    
    return { success: true, message: '연차 정보가 업데이트되었습니다.' };
  } catch (error) {
    return { success: false, message: '연차 정보 업데이트에 실패했습니다.' };
  }
}