// 근무 유형 선택 관련 유틸리티 함수들

import { Nurse } from '../types';

// 간호사의 선호 근무를 고려한 근무 유형 선택
export function selectWorkTypeByPreference(
  availableWorkTypes: string[],
  nurse: Nurse
): string {
  if (availableWorkTypes.length === 0) return 'O';
  if (availableWorkTypes.length === 1) return availableWorkTypes[0];
  
  // 간호사의 선호 근무 확인
  const preferences = nurse.workAvailability;
  
  // 선호 근무만 필터링
  const preferredTypes = availableWorkTypes.filter(workType => {
    switch (workType) {
      case 'D': return preferences.D;
      case 'E': return preferences.E;
      case 'N': return preferences.N;
      case 'M': return preferences.M;
      default: return false;
    }
  });
  
  // 선호 근무가 있으면 그 중에서 선택
  if (preferredTypes.length > 0) {
    return selectWorkTypeByPriority(preferredTypes, nurse);
  }
  
  // 선호 근무가 없으면 모든 가능한 근무 중에서 선택
  return selectWorkTypeByPriority(availableWorkTypes, nurse);
}

// 우선순위에 따른 근무 유형 선택
export function selectWorkTypeByPriority(
  workTypes: string[],
  nurse: Nurse
): string {
  if (workTypes.length === 0) return 'O';
  if (workTypes.length === 1) return workTypes[0];
  
  // RN과 AN의 우선순위 비율 적용
  let weightedTypes: string[] = [];
  
  if (nurse.position === 'RN') {
    // RN: D:E:N = 5:3:2
    workTypes.forEach(type => {
      switch (type) {
        case 'D':
          weightedTypes.push(...Array(5).fill('D'));
          break;
        case 'E':
          weightedTypes.push(...Array(3).fill('E'));
          break;
        case 'N':
          weightedTypes.push(...Array(2).fill('N'));
          break;
        default:
          weightedTypes.push(type);
      }
    });
  } else if (nurse.position === 'AN') {
    // AN: D:E:N:M = 3:2:2:4
    workTypes.forEach(type => {
      switch (type) {
        case 'D':
          weightedTypes.push(...Array(3).fill('D'));
          break;
        case 'E':
          weightedTypes.push(...Array(2).fill('E'));
          break;
        case 'N':
          weightedTypes.push(...Array(2).fill('N'));
          break;
        case 'M':
          weightedTypes.push(...Array(4).fill('M'));
          break;
        default:
          weightedTypes.push(type);
      }
    });
  } else {
    // HN은 기존 로직 유지
    return workTypes[Math.floor(Math.random() * workTypes.length)];
  }
  
  // 가중치가 적용된 배열에서 랜덤 선택
  return weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
}
