import { expect, test } from 'definitely-not-a-robot/playwright'

// Two widgets that only work with the events a person makes. Test your own page the same way.
const widgets = `
<input id="search" placeholder="Search fruit">
<ul id="suggestions"></ul>
<canvas id="pad" width="400" height="150" style="border: 1px solid #94a3b8"></canvas>
<p id="signed">Sign above</p>
<script>
  // Suggestions update on keyup, as many search boxes do. page.fill() sends no key events.
  const search = document.getElementById('search')
  search.addEventListener('keyup', () => {
    document.getElementById('suggestions').innerHTML = ['apple', 'apricot', 'banana']
      .filter((fruit) => fruit.startsWith(search.value))
      .map((fruit) => '<li>' + fruit + '</li>')
      .join('')
  })

  // The pad wants a real stroke. A mouse move with Playwright's defaults is one jump.
  const pad = document.getElementById('pad')
  const ink = pad.getContext('2d')
  let points = 0
  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId) // keep the stroke even if it strays off the pad
    points = 1
    ink.beginPath()
    ink.moveTo(e.offsetX, e.offsetY)
  })
  pad.addEventListener('pointermove', (e) => {
    if (!e.buttons) return
    points++
    ink.lineTo(e.offsetX, e.offsetY)
    ink.stroke()
  })
  pad.addEventListener('pointerup', () => {
    document.getElementById('signed').textContent = points > 10 ? 'Signed' : 'Too short, sign again'
  })
</script>`

test('suggests as you type', async ({ page, human }) => {
    await page.setContent(widgets)
    await human.type('#search', 'ap')
    await expect(page.locator('#suggestions li')).toHaveText(['apple', 'apricot'])
})

test('takes a drawn signature', async ({ page, human }) => {
    await page.setContent(widgets)
    const { x, y } = (await page.locator('#pad').boundingBox())!
    await human.drag({ x: x + 40, y: y + 110 }, { x: x + 360, y: y + 50 })
    await expect(page.locator('#signed')).toHaveText('Signed')
})
