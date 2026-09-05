#!/bin/zsh
# 端到端测试：创建运行 → 三个确认门 → 内容包
BASE=http://localhost:3001/api

RUN=$(curl -s -X POST $BASE/runs -H 'Content-Type: application/json' -d '{"templateId":"ecom.xhs-note","inputs":{"productName":"香薰蜡烛·雪松与海盐","sellingPoints":"大豆蜡天然,燃烧无烟,留香48小时","audience":"20-30岁租房独居女性","tone":"warm","priceBand":"¥89-129"}}')
echo "=== 1. 创建运行 ==="
echo "$RUN" | python3 -c "import json,sys; d=json.load(sys.stdin); print('runId:', d['id'], '| status:', d['status'], '| gate:', d.get('awaitingGate'), '| 候选数:', len(d.get('candidates',[])))"
RUN_ID=$(echo "$RUN" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

C1=$(echo "$RUN" | python3 -c "import json,sys; print(json.load(sys.stdin)['candidates'][1]['id'])")
R2=$(curl -s -X POST $BASE/runs/$RUN_ID/decide -H 'Content-Type: application/json' -d "{\"action\":\"confirm\",\"candidateId\":\"$C1\"}")
echo "=== 2. 确认选题 ==="
echo "$R2" | python3 -c "import json,sys; d=json.loads(sys.stdin.read(),strict=False); print('status:', d.get('status'), '| gate:', d.get('awaitingGate'), '| completedSteps:', d.get('completedSteps'))"

C2=$(echo "$R2" | python3 -c "import json,sys; print(json.loads(sys.stdin.read(),strict=False)['candidates'][0]['id'])")
R3=$(curl -s -X POST $BASE/runs/$RUN_ID/decide -H 'Content-Type: application/json' -d "{\"action\":\"confirm\",\"candidateId\":\"$C2\"}")
echo "=== 3. 确认文案 ==="
echo "$R3" | python3 -c "import json,sys; d=json.loads(sys.stdin.read(),strict=False); print('status:', d.get('status'), '| gate:', d.get('awaitingGate'))"

R3b=$(curl -s -X POST $BASE/runs/$RUN_ID/decide -H 'Content-Type: application/json' -d '{"action":"regenerate"}')
echo "=== 4a. 封面重生成 ==="
echo "$R3b" | python3 -c "import json,sys; d=json.loads(sys.stdin.read(),strict=False); print('status:', d.get('status'), '| 新候选数:', len(d.get('candidates',[])))"
C3b=$(echo "$R3b" | python3 -c "import json,sys; print(json.loads(sys.stdin.read(),strict=False)['candidates'][2]['id'])")
R4=$(curl -s -X POST $BASE/runs/$RUN_ID/decide -H 'Content-Type: application/json' -d "{\"action\":\"confirm\",\"candidateId\":\"$C3b\"}")
echo "=== 4b. 确认封面 → 完成 ==="
echo "$R4" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read(),strict=False)
print('status:', d.get('status'), '| completedSteps:', d.get('completedSteps'), '/', d.get('totalSteps'), '| cost: ¥', d.get('actualCost'))
pkg = d.get('contentPackage') or {}
print('内容包:', pkg.get('id'), '| channel:', pkg.get('channel'), '| 字段数:', len(pkg.get('fields',[])))
print('决策留痕:', len(d.get('decisions',[])), '次')
for f in pkg.get('fields',[]):
    v = f['value'][:40].replace(chr(10),' ')
    print('  - %s: %s...' % (f['key'], v))
"
