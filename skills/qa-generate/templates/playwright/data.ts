// Template: test-data. qa-generate adapts this to the project's entities.
// A dependency-light factory that produces valid, unique test data without
// pulling in a data library. Replace the entity shape with the target's.
let sequence = 0;

function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence}`;
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  const suffix = uniqueSuffix();
  return {
    email: `qa+${suffix}@example.com`,
    password: 'Passw0rd!-test',
    displayName: `QA User ${suffix}`,
    ...overrides,
  };
}
