# dougwithseismic/definitely-not-a-human 🤖

![GitHub Badge](https://img.shields.io/github/stars/dougwithseismic/definitely-not-a-robot?style=social&label=Star)

![Definitely Not A Robot](definitely-not-a-robot.gif)

HumanBrowser is a super simple wrapper around the Puppeteer browser that emulates human-like interactions for automation testing or web scraping tasks.

By leveraging puppeteer-extra and its StealthPlugin, it offers enhanced bot detection circumvention so you can keep on scraping and stay one step ahead.

The primary goal of HumanBrowser is to simulate behaviors that are indistinguishable from real human users. This is achieved by introducing randomness in various interactions, making the actions less predictable and more "human-like."

Beep Boop. I don't condone this behaviour.

## Why is randomness important?

In the world of automation, predictability is often the enemy. Web servers, especially those with anti-bot measures, can easily detect repeated patterns typical of bots. By introducing randomness:

- **Mimicking Human Behavior**: Humans are inherently unpredictable. Randomness in delays, mouse movements, and typing speeds makes the browser actions more similar to real users.
  
- **Evading Detection**: Many modern websites employ bot detection tools. Varying the behavior reduces the risk of being flagged as a bot, especially during web scraping or automated browsing.
  
- **Enhanced Test Scenarios**: For testing purposes, unpredictable actions can simulate a broader range of user interactions, potentially uncovering more bugs or issues.

## Features

### Initialization

Start by creating a new instance:

```typescript
import HumanBrowser from 'path-to-humanbrowser'

const browser = new HumanBrowser()
```

### Launching the browser

Initialize the browser:

```typescript
await browser.launch()
```

For custom configurations, pass the compatible puppeteer's browser launch options:

```typescript
await browser.launch({
  headless: false,
  defaultViewport: { width: 1440, height: 900 }
})
```
Anything you can do with a regular `puppeteer` instance, you can do here.

### Navigating to a URL

Navigate with ease:

```typescript
await browser.navigate('https://www.example.com')
```

### Human-like Mouse Movement to Elements

Move the mouse to an element in a non-linear, humanized path:

```typescript
await browser.moveToElement('#my-element-id')
```

Additional movement options, like `duration` and `steps`, allow for even more varied mouse movement behaviors.

### Simulating Jittery Mouse Movements

Humans rarely keep the mouse perfectly still:

```typescript
await browser.jitterMouse({ jitterCount: 5 })
```

The `jitterMouse` function emulates this behavior by making small, random movements around the current position.

### Typing Text with Human Nuances

Humans don't type at a constant speed:

```typescript
await browser.humanType('Hello, world!', 120) // Typing at approximately 120 words per minute
```

The function simulates human typing patterns by varying speeds between keypresses and occasionally introducing pauses, especially after punctuations. A small delay based on the difference in ASCII values is introduced to add that more flesh-bag human-like flow.

### Randomized Pauses

Humans don't operate in fixed intervals. Emulate this:

```typescript
await browser.wait(1000, 5000) // Waits for a random duration between 1 and 5 seconds
```

### Closing the browser

Cleanly close the browser post interactions:

```typescript
await browser.close()
```
