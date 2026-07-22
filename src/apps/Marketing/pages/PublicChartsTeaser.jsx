import React, { useEffect, useState } from "react";
import { subscribePublicCharts } from "../api/directoryApi";
import { mergePublicSongChart } from "./publicChartModel.js";

const PublicChartsTeaser = ({ navigate }) => {
  const [leaders, setLeaders] = useState([]);
  const [showingSongs, setShowingSongs] = useState(true);

  useEffect(() => subscribePublicCharts({
    limitCount: 3,
    onData: (charts) => {
      const members = Array.isArray(charts?.members) ? charts.members.slice(0, 3) : [];
      const useSongs = members.length === 0;
      setShowingSongs(useSongs);
      setLeaders(useSongs ? mergePublicSongChart(charts?.songs, 3) : members);
    },
    onError: () => {
      setShowingSongs(true);
      setLeaders(mergePublicSongChart([], 3));
    },
  }), []);

  return (
    <section className="mk3-discover-chart-teaser mk3-zone">
      <div>
        <span>BeauRocks Charts</span>
        <strong>{showingSongs ? "Every song has a crown." : "Who is moving the room?"}</strong>
      </div>
      {!!leaders.length && (
        <ol>
          {leaders.map((leader, index) => (
            <li key={leader.id || leader.memberKey || leader.songId}>
              <b>{index + 1}</b>
              <span>{showingSongs ? leader.songTitle : (leader.displayName || "BeauRocks Singer")}</span>
              <strong>{Math.max(0, Number(showingSongs ? leader.bestScore : leader.rankScore) || 0).toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => navigate("charts")}>View Charts</button>
    </section>
  );
};

export default PublicChartsTeaser;
