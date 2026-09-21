"use client";

import { useState } from "react";
import RequestCard from "@/components/RequestCard";
import type { RequestItem } from "@/app/requests/actions";

export default function HomeRequestsPreview({
  initialRequests,
  isLoggedIn,
}: {
  initialRequests: RequestItem[];
  isLoggedIn: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);

  function handleDeleted(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          isLoggedIn={isLoggedIn}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
