// 간호사 관련 유틸리티 함수들

import { Nurse } from '../types';

// 간호사를 직급별로 정렬 (HN > RN > N-RN > AN)
export function sortNursesByPosition(nurses: Nurse[]): Nurse[] {
  return nurses.sort((a, b) => {
    // HN > RN > N-RN > AN 순서로 정렬
    const getSortOrder = (nurse: Nurse) => {
      if (nurse.position === 'HN') return 1;
      if (nurse.position === 'RN' && !nurse.nightDedicated) return 2;
      if (nurse.nightDedicated) return 3;
      if (nurse.position === 'AN') return 4;
      return 5;
    };
    
    const orderA = getSortOrder(a);
    const orderB = getSortOrder(b);
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // 같은 직급 내에서는 근무가능 항목 개수가 적은 간호사를 우선 배정
    const getAvailableWorkCount = (nurse: Nurse) => {
      let count = 0;
      if (nurse.workAvailability.D) count++;
      if (nurse.workAvailability.E) count++;
      if (nurse.workAvailability.N) count++;
      if (nurse.workAvailability.M) count++;
      return count;
    };
    
    const availableCountA = getAvailableWorkCount(a);
    const availableCountB = getAvailableWorkCount(b);
    
    if (availableCountA !== availableCountB) {
      return availableCountA - availableCountB; // 적은 수를 우선
    }
    
    return a.name.localeCompare(b.name);
  });
}

// 우선순위에 따라 간호사 그룹화
export function getNursesByPriority(nurses: Nurse[]): { name: string, nurses: Nurse[] }[] {
  const groups = [
    { name: 'HN 간호사', nurses: nurses.filter(nurse => nurse.position === 'HN') },
    { name: '야간전담 간호사', nurses: nurses.filter(nurse => nurse.nightDedicated) },
    { name: 'RN 간호사', nurses: nurses.filter(nurse => nurse.position === 'RN' && !nurse.nightDedicated) },
    { name: 'AN 간호사', nurses: nurses.filter(nurse => nurse.position === 'AN' && !nurse.nightDedicated) }
  ];
  
  return groups.filter(group => group.nurses.length > 0);
}

// 간호사가 특정 날짜에 가능한 근무 유형 반환
export function getAvailableWorkTypes(
  nurse: Nurse, 
  day: number,
  isWeekend: boolean, 
  isHoliday: boolean
): string[] {
  const availableTypes: string[] = [];
  
  // 간호사의 근무 가능 유형 체크
  if (nurse.workAvailability.D) availableTypes.push('D');
  if (nurse.workAvailability.E) availableTypes.push('E');
  if (nurse.workAvailability.N) availableTypes.push('N');
  // M 근무는 AN만 가능
  if (nurse.workAvailability.M && nurse.position === 'AN') availableTypes.push('M');
  
  // 주말/공휴일에는 특정 근무 유형 제한 (필요시)
  if (isWeekend || isHoliday) {
    // 주말/공휴일에도 모든 근무 유형 가능 (간호사 특성상)
    return availableTypes;
  }
  
  return availableTypes;
}
