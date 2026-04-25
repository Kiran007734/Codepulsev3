import py_compile, glob, json
errors = {}
for f in glob.glob('c:/codepulse/backend/**/*.py', recursive=True):
    try:
        py_compile.compile(f, doraise=True)
    except Exception as e:
        errors[f] = str(e)
with open("c:/codepulse/backend/compile_errors.json", "w") as out:
    json.dump(errors, out, indent=2)
