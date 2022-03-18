import re
import json

with open("./samples.txt", 'r') as file:
    text = file.read()

    print(len(text))
    pat = re.compile(r"^(.+)\n^(.+)\n^(.+)\n<\|endoftext", re.MULTILINE)
    mat = re.findall(pat, text)
    print(mat)

    l = []
    for thing in mat:
        d = {
            'line1': thing[0],
            'line2': thing[1],
            'line3': thing[2],
        }
        l.append(d)

with open('haikus.json', 'w') as f:
    json.dump(l, f)


