import { contextDetectorSkills } from "@/lib/context-detector/skills";
import { SkillsResponse } from "@/lib/context-detector/types";
import { NextResponse } from "next/server";

export const GET = async (): Promise<NextResponse> => {
    const payload: SkillsResponse = {
        count: contextDetectorSkills.length,
        skills: contextDetectorSkills,
        note: "Les skills marqués requiresTool ne sont activés que si l'outil correspondant est configuré.",
    };

    return NextResponse.json(payload, { status: 200 });
};
