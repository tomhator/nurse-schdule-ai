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
  // 간호사별 월별 스케줄 저장소 (year -> month -> day -> status)
  schedules?: {
    [year: number]: {
      [month: number]: {
        [day: number]: string;
      }
    }
  };
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
  } catch {
    console.error('간호사 목록을 불러오는데 실패했습니다.');
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
    return { success: false, message: '연차 정보 업데이트에 실패했습니다.' };
  }
}

// 간호사 월별 스케줄 저장 (클라이언트 사이드)
// currentMonthData 예: { "<nurseId>-<day>": "D|E|N|M|O|-", ... }
export function saveMonthlySchedulesToNurses(year: number, month: number, currentMonthData: { [key: string]: string }): { success: boolean; message: string } {
  try {
    const savedData = localStorage.getItem('nurses_data');
    if (!savedData) {
      return { success: false, message: '간호사 데이터를 찾을 수 없습니다.' };
    }

    const nurses: Nurse[] = JSON.parse(savedData);

    // 간호사별로 해당 월의 스케줄 매핑
    const nurseIdToDayStatusMap: { [nurseId: number]: { [day: number]: string } } = {};

    Object.entries(currentMonthData).forEach(([key, status]) => {
      // key 형식: "<nurseId>-<day>"
      const [nurseIdStr, dayStr] = key.split('-');
      const nurseId = parseInt(nurseIdStr, 10);
      const day = parseInt(dayStr, 10);
      if (!Number.isNaN(nurseId) && !Number.isNaN(day)) {
        if (!nurseIdToDayStatusMap[nurseId]) {
          nurseIdToDayStatusMap[nurseId] = {};
        }
        nurseIdToDayStatusMap[nurseId][day] = status;
      }
    });

    // 각 간호사 객체에 schedules 병합/설정
    const updatedNurses = nurses.map((nurse) => {
      const monthMap = nurseIdToDayStatusMap[nurse.id] || {};
      if (Object.keys(monthMap).length === 0) return nurse; // 해당 월 데이터 없음

      const schedules = nurse.schedules ? { ...nurse.schedules } : {} as NonNullable<Nurse['schedules']>;
      const yearMap = schedules[year] ? { ...schedules[year] } : {} as { [month: number]: { [day: number]: string } };
      yearMap[month] = { ...monthMap };
      schedules[year] = yearMap;

      return { ...nurse, schedules };
    });

    localStorage.setItem('nurses_data', JSON.stringify(updatedNurses));
    return { success: true, message: `${year}년 ${month}월 간호사별 스케줄이 저장되었습니다.` };
  } catch {
    return { success: false, message: '간호사별 스케줄 저장에 실패했습니다.' };
  }
}