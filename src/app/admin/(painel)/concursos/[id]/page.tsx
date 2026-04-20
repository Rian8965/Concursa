"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CompetitionFormPage from "../novo/page";

export default function EditCompetitionPage() {
  const params = useParams();
  return <CompetitionFormPage params={Promise.resolve({ id: params.id as string })} />;
}
