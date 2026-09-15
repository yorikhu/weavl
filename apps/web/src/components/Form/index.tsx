"use client";

import { ComposerTextarea } from "./components/ComposerTextarea";
import { FormRoot } from "./components/FormRoot";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { Textarea } from "./components/Textarea";

/**
 * 轻量受控表单命名空间。
 * Form 统一管理 values，子控件通过 name 自动读写对应字段，也可脱离 Form 单独受控使用。
 */
export const Form = Object.assign(FormRoot, { Input, Textarea, ComposerTextarea, Select });
