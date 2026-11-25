import armory from "../fixtures/armory-sample.json";
import siblings from "../fixtures/siblings-sample.json";

export const demoRequest: typeof fetch = async (input, init) => {
  init?.signal?.throwIfAborted();
  const url = new URL(String(input));
  if (url.pathname === "/news/alarms") return Response.json([]);
  const isSiblings = url.pathname.endsWith("/siblings");
  const name = decodeURIComponent(
    url.pathname.split("/").at(isSiblings ? -2 : -1) ?? "",
  );
  const states: Record<string, number> = {
    키오류: 401,
    없는캐릭터: 404,
    호출제한: 429,
    서버점검: 503,
    서버오류: 500,
  };
  if (name === "연결오류") throw new TypeError("Demo connection failure");
  if (states[name]) return Response.json(null, { status: states[name] });
  if (isSiblings) return Response.json(siblings);
  const profile = siblings.find((entry) => entry.CharacterName === name);
  if (!profile) return Response.json(null);
  return Response.json({
    ...armory,
    ArmoryProfile: { ...armory.ArmoryProfile, ...profile },
  });
};
