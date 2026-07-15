import React, { useEffect, useState } from "react";
import { subscribePublicCharts } from "../api/directoryApi";

const PublicChartsTeaser = ({ navigate }) => {
  const [members, setMembers] = useState([]);

  useEffect(() => subscribePublicCharts({
    limitCount: 3,
    onData: (charts) => setMembers(Array.isArray(charts?.members) ? charts.members.slice(0, 3) : []),
    onError: () => setMembers([]),
  }), []);

  return (
    <section className="mk3-discover-chart-teaser mk3-zone">
      <div>
        <span>BeauRocks Charts</span>
        <strong>{members.length ? "Who is moving the room?" : "The first global scores are waiting."}</strong>
      </div>
      {!!members.length && (
        <ol>
          {members.map((member, index) => (
            <li key={member.id || member.memberKey}>
              <b>{index + 1}</b>
              <span>{member.displayName || "BeauRocks Singer"}</span>
              <strong>{Math.max(0, Number(member.rankScore || 0) || 0).toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => navigate("charts")}>View Charts</button>
    </section>
  );
};

export default PublicChartsTeaser;
