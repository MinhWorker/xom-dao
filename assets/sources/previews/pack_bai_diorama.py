"""Composite the Blender review frames over a quiet sky and export a looping GIF.

python3 assets/sources/previews/pack_bai_diorama.py
Review files remain in .blender/bai-diorama; production hub assets are not overwritten.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.blender/bai-diorama'


def sky(size):
    width, height = size
    image = Image.new('RGB', size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t=y/(height-1)
        color=tuple(round(a*(1-t)+b*t) for a,b in zip((113,178,209),(218,235,229)))
        draw.line((0,y,width,y),fill=color)
    clouds=Image.new('RGBA',size)
    pen=ImageDraw.Draw(clouds)
    for x,y,r in [(.07,.30,.12),(.90,.18,.15),(.04,.88,.15),(.88,.86,.18),(.53,.98,.20)]:
        for dx,dy,s in [(-.7,0,.8),(0,-.2,1),(.8,.1,.75)]:
            cx,cy=(x+dx*r)*width,(y+dy*r)*height
            rx,ry=r*s*width,r*s*height*.43
            pen.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill=(246,250,243,110))
    clouds=clouds.filter(ImageFilter.GaussianBlur(width*.022))
    return Image.alpha_composite(image.convert('RGBA'),clouds)


def composite(path):
    with Image.open(path) as frame:
        frame=frame.convert('RGBA')
        return Image.alpha_composite(sky(frame.size),frame).convert('RGB')


def main():
    still=OUT/'still.png'
    if still.exists():
        composite(still).save(OUT/'bai-diorama-review.png')
    paths=sorted(OUT.glob('frame-*.png'))
    if not paths:
        return
    frames=[composite(path) for path in paths]
    # A shared palette prevents color flicker between animation frames.
    contact=Image.new('RGB',(frames[0].width*4,frames[0].height*2))
    for i in range(8):
        contact.paste(frames[round(i*(len(frames)-1)/7)],((i%4)*frames[0].width,(i//4)*frames[0].height))
    palette=contact.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    indexed=[frame.quantize(palette=palette,dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]
    durations=[round((i+1)*400/len(frames))*10-round(i*400/len(frames))*10 for i in range(len(frames))]
    indexed[0].save(OUT/'bai-diorama-review.gif',save_all=True,append_images=indexed[1:],duration=durations,loop=0,optimize=False,disposal=1)
    frames[0].save(OUT/'bai-diorama-review.png')
    print(f'{len(frames)} frames, {sum(durations)} ms total: {OUT / "bai-diorama-review.gif"}')


if __name__ == '__main__':
    main()
