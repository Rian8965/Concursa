"use client";

import { useEffect } from "react";
import { BuilderComponent, builder } from "@builder.io/react";

type Props = {
  content: any;
};

export function BuilderContent({ content }: Props) {
  const key = process.env.NEXT_PUBLIC_BUILDER_API_KEY?.trim() || "";

  useEffect(() => {
    if (key) builder.init(key);
  }, [key]);

  if (!key) return null;
  if (!content) return null;

  return <BuilderComponent model="page" content={content} />;
}

