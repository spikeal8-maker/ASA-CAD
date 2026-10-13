import React from 'react';

/**
 * Non-blocking Part work-area status. It is drawn over the persistent scene
 * and never replaces it: the origin, planes and navigation stay available.
 */
export function PartStageStatus(props: { runtimeStatus: string; fixtureError?: string }) {
  if (props.fixtureError) {
    return (
      <div className="part-stage-status error" role="alert">
        <strong>Ошибка перестроения</strong>
        <span>B-Rep не построен</span>
        <small>{props.fixtureError}</small>
      </div>
    );
  }
  if (props.runtimeStatus !== 'loading') return null;
  return (
    <div className="part-stage-status" role="status">
      <span>Загрузка OpenCascade…</span>
    </div>
  );
}
