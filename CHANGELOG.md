# Changelog

## [0.0.2] - 2023-08-02

### Added

#### Human-like Mouse Movement to Elements

Move the mouse to an element in a non-linear, humanized path, then click it. To act like a human, you must first move like a human so we split our mouse movement into segments and introduce randomness into each, depending on the distance between the current and target positions.

```typescript
await browser.humanMove('#my-element-id', { hesitationBeforeClick: true })
```
