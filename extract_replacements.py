import json
path = r'C:\Users\heman\.gemini\antigravity-ide\brain\4ee5602f-8f0f-4781-a9a8-811fff27c166\.system_generated\logs\transcript_full.jsonl'
output = []
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'PLANNER_RESPONSE':
            for tc in data.get('tool_calls', []):
                if tc['name'] in ['multi_replace_file_content', 'replace_file_content']:
                    args = tc.get('args', {})
                    target_file = args.get('TargetFile', '')
                    if 'ReplacementChunks' in args:
                        for chunk in args['ReplacementChunks']:
                            output.append(f"=== TARGET FILE: {target_file} ===\n{chunk.get('ReplacementContent', '')}")
                    elif 'ReplacementContent' in args:
                        output.append(f"=== TARGET FILE: {target_file} ===\n{args.get('ReplacementContent', '')}")

with open('all_replacements.txt', 'w', encoding='utf-8') as out:
    for o in output:
        out.write(o + '\n\n')
