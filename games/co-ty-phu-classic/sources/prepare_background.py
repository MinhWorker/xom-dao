"""Convert the owner's idle clip to a silent Theora loop with a blended seam."""
from pathlib import Path
import argparse
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = root / "assets/night-waterfront.ogv"
# Start at 0.8s; bridge the last 0.8s into the first 0.8s, ending exactly at the start.
filters = (
    "[0:v]fps=15,scale=1280:720,setsar=1,split=3[a][b][c];"
    "[a]trim=start=0.8:end=9.2,setpts=PTS-STARTPTS[middle];"
    "[b]trim=start=9.2:end=10,setpts=PTS-STARTPTS[tail];"
    "[c]trim=start=0:end=0.8,setpts=PTS-STARTPTS[head];"
    "[tail][head]blend=all_expr='A*(1-T/0.8)+B*T/0.8'[bridge];"
    "[middle][bridge]concat=n=2:v=1:a=0,format=yuv420p[out]"
)
subprocess.run([
    "ffmpeg", "-y", "-v", "error", "-i", str(args.input),
    "-filter_complex", filters, "-map", "[out]", "-an",
    "-c:v", "libtheora", "-q:v", "6", str(output),
], check=True)
shutil.copy2(output, root / "godot/art/night-waterfront.ogv")
print(output)
