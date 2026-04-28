"use client";

type VisitRow = {
  id: string;
  storeName: string;
  visitDate: string;
  checkInAt: string;
  checkOutAt: string;
};

type MchVisitTableProps = {
  visits: VisitRow[];
};

function formatLocalDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function MchVisitTable({ visits }: MchVisitTableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Store</th>
          <th>Date</th>
          <th>In</th>
          <th>Out</th>
        </tr>
      </thead>
      <tbody>
        {visits.length > 0 ? (
          visits.map((visit) => (
            <tr key={visit.id}>
              <td>{visit.storeName}</td>
              <td>{visit.visitDate}</td>
              <td>{formatLocalDateTime(visit.checkInAt)}</td>
              <td>{formatLocalDateTime(visit.checkOutAt)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4}>No visits logged for this day.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
