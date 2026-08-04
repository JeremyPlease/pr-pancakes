import React from 'react';
import styled from 'styled-components';

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background-color: #161b22;
  border-radius: 10px;
  padding: 16px 18px;
  border: 1px solid #21262d;
`;

const StatTitle = styled.h3`
  color: #8b949e;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
`;

// Hero numbers wear text ink; color is reserved for status
const StatValue = styled.div`
  color: #f0f6fc;
  font-size: 1.9rem;
  font-weight: 700;
  margin: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &[data-status="good"] {
    color: #2ea043;
  }

  &[data-status="warning"] {
    color: #d29922;
  }

  &[data-status="serious"] {
    color: #f85149;
  }
`;

const StatSubtext = styled.div`
  color: #8b949e;
  font-size: 12px;
  margin-top: 6px;
`;

// items: [{ icon, title, value, subtext, status? }]
const StatTiles = ({ items }) => (
  <StatsContainer>
    {items.map((item) => (
      <StatCard key={item.title}>
        <StatTitle>
          {item.icon} {item.title}
        </StatTitle>
        <StatValue data-status={item.status}>{item.value}</StatValue>
        <StatSubtext>{item.subtext}</StatSubtext>
      </StatCard>
    ))}
  </StatsContainer>
);

export default StatTiles;
