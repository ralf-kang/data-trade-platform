# 워드클라우드의 한국어 형태소 분석(조사·어미 제거)을 위해 Elastic 공식 analysis-nori
# 플러그인을 설치한 이미지. mecab-ko-wasm(npm)이 실사용에서 동작하지 않는 것을 확인한 뒤
# 채택한 대안 — docs/워드클라우드-설계.md §5-2 참고.
FROM docker.elastic.co/elasticsearch/elasticsearch:9.1.3
RUN elasticsearch-plugin install --batch analysis-nori
