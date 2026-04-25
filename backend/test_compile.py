import py_compile, glob, traceback
for f in glob.glob('c:/codepulse/backend/**/*.py', recursive=True):
    try:
        py_compile.compile(f, doraise=True)
    except py_compile.PyCompileError as e:
        print(f"ERROR IN {f}: {e}")
