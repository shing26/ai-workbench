# 03 鈥?S7-3: MOA node circuit-breaker (3s timeout + 429 degradation)

**What to build:** MOA 鑺傜偣鏁呴殰闄嶇骇鈥斺€旇秴鏃?>3s 鎴?429 鏃舵爣璁?Disconnected锛屽叾浣欒妭鐐圭户缁祦寮忥紝鐣岄潰涓嶅崱姝汇€?
**Blocked by:** None 鈥?can start immediately.

**Status:** completed

- [ ] `streamProviderLive` 瓒呮椂榛樿 30s 鈫?MOA 鍦烘櫙鏀剁揣涓?3s 棣?token 瓒呮椂锛堥鍧楀墠 AbortController 璁℃椂锛?- [ ] 429/5xx 鈫?鑺傜偣鏍囪 `Disconnected`锛坄data-moa-node-status`锛夛紝璺宠繃閲嶈瘯锛屽叾浣欒妭鐐圭户缁?- [ ] 鍓嶇 MOA lane 瀵?Disconnected 鑺傜偣鏄剧ず闄嶇骇寰芥爣锛坄Disconnected` 鑰岄潪 Stop/Retry锛?- [ ] 鍏朵綑鑺傜偣缁х画鎵撳瓧娴佽緭鍑猴紝busy 涓嶈澶辫触鑺傜偣闃诲
- [ ] verify lane锛歮ock 涓€涓參鑺傜偣锛?3s锛? 涓€涓?429 鈫?鏂█蹇妭鐐瑰畬鎴愩€佹參鑺傜偣 Disconnected銆佺晫闈笉鍗?
**Definition of Done:** 鍗曡妭鐐规晠闅滀笉褰卞搷鏁翠綋娴佸紡锛涜嚜鍔ㄦ爣璁?Disconnected锛涙棤鐣岄潰鍗℃銆侫C-2.3銆?
