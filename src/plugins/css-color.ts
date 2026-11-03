// Plugins are created in Node, where there's no CSS.supports(), so a colour is checked by its
// shape: a hex code, a colour function, or one of the names CSS knows. A typo like 'blu' would
// otherwise be dropped by the browser and the cursor drawn in nothing.

/** The colour keywords of CSS Color 4: the named colours and the current system colours. */
export const CSS_COLOR_NAMES = new Set(
    (
        'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
        'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
        'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
        'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
        'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
        'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
        'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
        'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
        'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
        'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
        'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
        'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
        'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
        'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
        'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
        'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
        'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow ' +
        'yellowgreen transparent currentcolor accentcolor accentcolortext activetext buttonborder ' +
        'buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext ' +
        'linktext mark marktext selecteditem selecteditemtext visitedtext'
    ).split(' ')
)

const HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i
// The arguments are left to the browser; the name is what a typo usually breaks.
const FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(.+\)$/i

/** Whether `value` looks like a CSS colour: a hex code, a colour function or a colour name. */
export function isCssColor(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const color = value.trim()
    return HEX.test(color) || FUNCTION.test(color) || CSS_COLOR_NAMES.has(color.toLowerCase())
}
