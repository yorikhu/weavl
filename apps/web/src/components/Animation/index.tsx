"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import GlareHover from "./components/GlareHover";

const AeroShards = memo(dynamic(() => import("./components/AeroShards"), { ssr: false }));

/**
 * 全局视觉动画命名空间。
 * AeroShards 提供 WebGPU 背景粒子，GlareHover 为卡片提供跟随指针的克制反光。
 */
export const Animation = Object.assign({}, { AeroShards, GlareHover });
