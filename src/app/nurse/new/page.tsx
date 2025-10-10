'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addNurse, Nurse } from '../action';

export default function NewNursePage() {
  const router = useRouter();
  const [nurseData, setNurseData] = useState<Omit<Nurse, 'id'>>({
    name: '',
    position: 'RN',
    weekendWork: true,
    workAvailability: { D: false, E: false, N: false, M: false },
    nightDedicated: false,
    remainingVacation: 15,
    usedVacation: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nurseData.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = addNurse(nurseData);
      if (result.success) {
        alert(result.message);
        router.push('/nurse');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('간호사 추가 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkAvailabilityChange = (shift: string, checked: boolean) => {
    setNurseData({
      ...nurseData,
      workAvailability: {
        ...nurseData.workAvailability,
        [shift]: checked
      }
    });
  };

  const handleNightDedicatedChange = (checked: boolean) => {
    setNurseData({
      ...nurseData,
      nightDedicated: checked,
      workAvailability: checked 
        ? { D: false, E: false, N: true, M: false }  // 야간전담이면 N만 체크
        : { D: false, E: false, N: false, M: false } // 야간전담 해제시 모든 근무 해제
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="nav bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 제목 */}
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">간호사 추가</h1>
            </div>

            {/* 우측 메뉴 */}
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                근무표
              </Link>
              <Link 
                href="/nurse"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                간호사 관리
              </Link>
              <Link 
                href="/staffing"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                일일 필수 근무 인원 설정
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 바디 */}
      <main className="schedule max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">새 간호사 정보 입력</h2>
            <p className="text-sm text-gray-600">간호사의 기본 정보와 근무 가능 시간을 입력해주세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nurseData.name}
                  onChange={(e) => setNurseData({ ...nurseData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="간호사 이름을 입력하세요"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">직책</label>
                <select
                  value={nurseData.position}
                  onChange={(e) => setNurseData({ ...nurseData, position: e.target.value as 'HN' | 'RN' | 'AN' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="HN">HN (수간호사)</option>
                  <option value="RN">RN (간호사)</option>
                  <option value="AN">AN (간호조무사)</option>
                </select>
              </div>
            </div>

            {/* 근무 설정 */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">근무 설정</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={nurseData.weekendWork}
                      onChange={(e) => setNurseData({ ...nurseData, weekendWork: e.target.checked })}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">주말근무 가능</span>
                  </label>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={nurseData.nightDedicated}
                      onChange={(e) => handleNightDedicatedChange(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">야간전담근무자</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">근무 가능 시간</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: 'D', label: 'D (주간)', description: '07:00-15:30' },
                    { key: 'E', label: 'E (저녁)', description: '14:00-22:00' },
                    { key: 'N', label: 'N (야간)', description: '21:00-08:00' },
                    { key: 'M', label: 'M (오전)', description: '09:00-17:00' }
                  ].map(({ key, label, description }) => (
                    <label key={key} className="flex flex-col items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nurseData.workAvailability[key as keyof typeof nurseData.workAvailability]}
                        onChange={(e) => handleWorkAvailabilityChange(key, e.target.checked)}
                        disabled={nurseData.nightDedicated && key !== 'N'}
                        className={`mb-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                          nurseData.nightDedicated && key !== 'N' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-xs text-gray-500">{description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 연차 정보 */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">연차 정보</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">잔여 연차</label>
                  <input
                    type="number"
                    value={nurseData.remainingVacation}
                    onChange={(e) => setNurseData({ ...nurseData, remainingVacation: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="30"
                  />
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Link
                href="/nurse"
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '추가 중...' : '간호사 추가'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
