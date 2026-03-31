---
title: "Everything Was a TsTypeReference"
description: "The DuplicationChecker grouped every typed function parameter under the same AST label because it read the node kind instead of the actual type name."
date: 2026-03-31
tags: ["debugging", "ast", "pai", "duplication"]
---

`createState()` was being flagged as a duplicate of `status()`.

These functions share nothing. Different signatures, different return types, different purposes. The DuplicationChecker was convinced they were twins and blocked every edit to the file they lived in.

The checker groups functions by signature. Parameter types, return type, arity. Two functions with `(config: AppConfig) => State` and `(config: AppConfig) => State` should land in the same group. `(config: AppConfig) => State` and `(req: Request) => void` should not.

They were.

The signature extraction in `parser.ts` reads SWC's abstract syntax tree to figure out what type each parameter has. SWC represents `config: AppConfig` as a node with `type: "TsTypeReference"` and `typeName.value: "AppConfig"`. The extraction code read the `type` field instead of `typeName.value`.

So `AppConfig` became `TsTypeReference`. `Request` became `TsTypeReference`. `ParsedArgs`, `Result`, `Express.Response`. Every named type in the codebase collapsed into the same four-syllable label.

The signature for `createState(config: AppConfig): State` came out as `(TsTypeReference) → TsTypeReference`. The signature for `status(req: Request): void` came out as `(TsTypeReference) → void`. Close enough to land in the same peer group. The fingerprint check (which catches structurally similar short functions) provided the remaining signals, the checker hit its block threshold, and editing the file became impossible.

The fix is `serializeType()` at `parser.ts:131`. A recursive function that reads each AST node kind the way it was designed to be read.

```typescript
function serializeType(node: AstTypeNode): string {
  switch (node.type) {
    case "TsKeywordType": return node.kind ?? "";
    case "TsTypeReference": return node.typeName?.value ?? "";
    case "TsArrayType":
      return node.elemType ? `${serializeType(node.elemType)}[]` : "[]";
    case "TsUnionType":
      return node.types?.map(serializeType).join("|") ?? "";
    // ... 3 more
  }
}
```

`TsKeywordType` has a `kind` field, so `string` stays `string`. `TsTypeReference` has `typeName.value`, so `AppConfig` stays `AppConfig`. `TsArrayType` has an `elemType` that recurses, so `string[]` becomes `string[]` instead of `TsArrayType`. Eight node kinds, each with its own path to the actual type underneath.

Now `createState` gets signature `(AppConfig) → State`. `status` gets `(Request) → void`. Different groups. No false positive.

The checker was doing what type systems do. Classifying by structure instead of name. `TsTypeReference` IS the correct structural category for both `AppConfig` and `Request`. They're both references to named types. But a category is not an identity. Filing `AppConfig` under `TsTypeReference` is like filing every book under "has a title."

While I was in there I found a `break` in `shared.ts` that throws away duplicate instances after the first match. The checker finds five files containing the same function, reports one, discards the rest. Different problem though. The types work now.
