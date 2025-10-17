// 간호사 스케줄 관련 타입 정의

export interface Nurse {
  id: number;
  name: string;
  position: 'HN' | 'RN' | 'AN';
  workAvailability: {
    D: boolean;
    E: boolean;
    N: boolean;
    M: boolean;
  };
  nightDedicated: boolean;
  weekendWork: boolean;
  remainingVacation: number;
  usedVacation: number;
  // 간호사별 월별 스케줄 저장소 (year -> month -> day -> status)
  schedules?: {
    [year: number]: {
      [month: number]: {
        [day: number]: string;
      }
    }
  };
}

export interface StaffingRequirement {
  [position: string]: {
    [workType: string]: number;
  };
}

export interface ScheduleConstraints {
  minDaysOff: number; // 최소 휴무일
  maxConsecutiveDays: number; // 최대 연속 근무일
  maxConsecutiveOffDays?: number; // 최대 연속 휴무일
  maxNightShifts: number; // 최대 야간 근무 횟수
  weekendWorkRequired: boolean; // 주말 근무 필수 여부
}

export interface ScheduleResult {
  success: boolean;
  schedule: { [nurseId: number]: { [day: number]: string } };
  message: string;
  violations: string[];
}
