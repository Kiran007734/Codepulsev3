import traceback, json
try:
    import main
except Exception as e:
    with open("out.json", "w") as f:
        f.write(json.dumps(traceback.format_exc()))
except SyntaxError as e:
    with open("out.json", "w") as f:
        f.write(json.dumps(f"SYNTAX ERROR in {e.filename} line {e.lineno} offset {e.offset}: {e.msg}"))

