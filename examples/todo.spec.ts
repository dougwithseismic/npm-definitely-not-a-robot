import { expect, test } from 'definitely-not-a-robot/playwright'

test('adds a todo', async ({ page, human }) => {
    await page.goto('https://demo.playwright.dev/todomvc')
    await human.type('.new-todo', 'Buy milk')
    await human.press('Enter')
    await expect(page.getByTestId('todo-title')).toHaveText('Buy milk')
})
