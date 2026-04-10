with open(r"c:\Users\Raj Singh\Desktop\driver\backend\main.py", "rb") as f:
    data = f.read()
data = data.replace(b'\x00', b'')
with open(r"c:\Users\Raj Singh\Desktop\driver\backend\main.py", "wb") as f:
    f.write(data)
print("Stripped null bytes!")
