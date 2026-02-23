import React from "react";

const EmptyStatePanel = ({ title = "", description = "", actions = [], onAction }) => (
  <div className="mk3-status mk3-empty-state">
    <strong>{title || "No results yet."}</strong>
    <span>{description || "Try a different route or action."}</span>
    <div className="mk3-actions-inline">
      {(Array.isArray(actions) ? actions : []).map((action) => (
        <button key={action.id || action.label} type="button" onClick={() => onAction?.(action)}>
          {action.label || "Continue"}
        </button>
      ))}
    </div>
  </div>
);

export default EmptyStatePanel;

