import { Page, ElementHandle } from 'puppeteer';
import { initDebugCanvas, debugDrawSegment } from './debugUtils';
import { MovementOptions } from './types';

const defaultOptions: MovementOptions = {
    scrollBeforeMove: true,
    variablePath: true,
    hesitationBeforeClick: true,
    maxPause: 1,
    minPause: 0,
    debug: true,
    fadeDuration: 500,
};

const BUFFER = 20;
const MIN_SEGMENTS = 2;
const MAX_SEGMENTS = 50;
const CLICK_DELAY_MIN = 50;
const CLICK_DELAY_MAX = 150;

async function randomPause(page: Page, min: number, max: number) {
    const delay = Math.random() * (max - min) + min;
    await new Promise((r) => setTimeout(r, delay));
}

function getEndCoordinates(box: any, target: string | undefined): { x: number; y: number } {
    switch (target) {
        case 'top-left':
            return { x: box.x + Math.random() * BUFFER, y: box.y + Math.random() * BUFFER };
        case 'top-right':
            return { x: box.x + box.width - Math.random() * BUFFER, y: box.y + Math.random() * BUFFER };
        case 'bottom-left':
            return { x: box.x + Math.random() * BUFFER, y: box.y + box.height - Math.random() * BUFFER };
        case 'bottom-right':
            return { x: box.x + box.width - Math.random() * BUFFER, y: box.y + box.height - Math.random() * BUFFER };
        default:
            return { x: box.x + Math.random() * box.width, y: box.y + Math.random() * box.height };
    }
}

export async function humanMouseMove(
    page: Page,
    element: ElementHandle<Element>,
    options: MovementOptions = defaultOptions
) {
    options = { ...defaultOptions, ...options };

    const box = await element.boundingBox();
    if (!box) throw new Error('Failed to fetch the bounding box of the element.');

    const viewport = page.viewport();
    if (!viewport) throw new Error('Viewport is not defined.');

    const startX = options.startX ?? Math.random() * viewport.width;
    const startY = options.startY ?? Math.random() * viewport.height;

    const { x: endX, y: endY } = getEndCoordinates(box, options.target);

    await drawBezierMovement(page, startX, startY, endX, endY, options);

    if (options.hesitationBeforeClick) {
        await randomPause(page, options.minPause!, options.maxPause!);
    }

    const clickDelay = CLICK_DELAY_MIN + Math.random() * (CLICK_DELAY_MAX - CLICK_DELAY_MIN);
    await page.mouse.click(endX, endY, { delay: clickDelay });

    return { x: endX, y: endY };
}

function computeBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    return uu * u * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + tt * t * p3;
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export async function drawBezierMovement(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: MovementOptions
) {
    const ctrlPt1X = startX + Math.random() * (endX - startX) * 0.5;
    const ctrlPt1Y = startY + Math.random() * (endY - startY) * 0.5;
    const ctrlPt2X = endX - Math.random() * (endX - startX) * 0.5;
    const ctrlPt2Y = endY - Math.random() * (endY - startY) * 0.5;

    if (options.debug) {
        await initDebugCanvas(page);
    }

    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.floor(distance / 10)));

    let prevX = startX;
    let prevY = startY;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = computeBezier(t, startX, ctrlPt1X, ctrlPt2X, endX);
        const y = computeBezier(t, startY, ctrlPt1Y, ctrlPt2Y, endY);

        await page.mouse.move(x, y);

        if (options.debug) {
            await debugDrawSegment(page, prevX, prevY, x, y, options);
        }

        prevX = x;
        prevY = y;

        const easedT = easeInOutCubic(t);
        const adjustedPause = options.minPause! + (options.maxPause! - options.minPause!) * easedT;

        await randomPause(page, adjustedPause, adjustedPause + 10);
    }
}
