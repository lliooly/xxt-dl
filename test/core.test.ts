import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewMarkdown,
  collectCandidateLinks,
  collectCourseEntryLinks,
  collectTaskLinks,
  dedupeLinks,
  extractUrlsFromText,
  filenameForAssignment,
  isReadyToReadUrl,
  isAssignmentLikeLink,
  isAssignmentTaskLink,
  isCourseEntryLink,
  resolveLoginQrImageUrl,
  resolveCourseQueryInput,
  selectCourseEntry,
} from "../src/core.js";

test("isAssignmentLikeLink keeps likely assignment links", () => {
  assert.equal(
    isAssignmentLikeLink({
      text: "查看作业",
      href: "https://mooc1.chaoxing.com/work/doHomeWork",
    }),
    true,
  );

  assert.equal(
    isAssignmentLikeLink({
      text: "章节测验",
      href: "https://mooc1.chaoxing.com/test/reVersionTestStartNew",
    }),
    true,
  );
});

test("isAssignmentLikeLink rejects empty and unrelated links", () => {
  assert.equal(isAssignmentLikeLink({ text: "首页", href: "" }), false);
  assert.equal(
    isAssignmentLikeLink({
      text: "个人空间",
      href: "https://i.chaoxing.com/base",
    }),
    false,
  );
});

test("isAssignmentTaskLink keeps concrete work task links only", () => {
  assert.equal(
    isAssignmentTaskLink({
      text: "作业20260529",
      href: "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=261847689&classId=143578477&workId=53773416&answerId=55424840",
    }),
    true,
  );

  assert.equal(
    isAssignmentTaskLink({
      text: "作业",
      href: "https://mooc1.chaoxing.com/mooc2/work/list",
    }),
    false,
  );
});

test("isCourseEntryLink keeps Chaoxing course middle links", () => {
  assert.equal(
    isCourseEntryLink({
      text: "",
      href: "https://mooc1-1.chaoxing.com/mooc-ans/visit/stucoursemiddle?courseid=261847689&clazzid=143578477&vc=1",
    }),
    true,
  );

  assert.equal(
    isCourseEntryLink({
      text: "首页",
      href: "https://i.chaoxing.com/base",
    }),
    false,
  );
});

test("dedupeLinks removes duplicate hrefs and trims text", () => {
  const links = dedupeLinks([
    { text: " 查看作业 ", href: "https://example.com/a" },
    { text: "重复", href: "https://example.com/a" },
    { text: "章节测验", href: "https://example.com/b" },
  ]);

  assert.deepEqual(links, [
    { text: "查看作业", href: "https://example.com/a" },
    { text: "章节测验", href: "https://example.com/b" },
  ]);
});

test("extractUrlsFromText finds absolute and relative urls in event handlers", () => {
  assert.deepEqual(
    extractUrlsFromText("open('/work/doHomeWork?courseId=123')", "https://mooc1.chaoxing.com/course"),
    ["https://mooc1.chaoxing.com/work/doHomeWork?courseId=123"],
  );

  assert.deepEqual(
    extractUrlsFromText("location.href='https://mooc1.chaoxing.com/work/list'", "https://i.chaoxing.com/"),
    ["https://mooc1.chaoxing.com/work/list"],
  );
});

test("collectCandidateLinks reads href, data urls, and onclick urls", () => {
  const links = collectCandidateLinks(
    [
      {
        text: "作业",
        href: "javascript:void(0)",
        onclick: "open('/work/doHomeWork?courseId=123')",
        dataset: {},
      },
      {
        text: "章节测验",
        href: "",
        onclick: "",
        dataset: { url: "/test/reVersionTestStartNew?id=7" },
      },
      {
        text: "作业20260529",
        data: "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=1&workId=2",
        dataset: {},
      },
    ],
    "https://mooc1.chaoxing.com/course",
  );

  assert.deepEqual(links, [
    {
      text: "作业",
      href: "https://mooc1.chaoxing.com/work/doHomeWork?courseId=123",
    },
    {
      text: "章节测验",
      href: "https://mooc1.chaoxing.com/test/reVersionTestStartNew?id=7",
    },
    {
      text: "作业20260529",
      href: "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=1&workId=2",
    },
  ]);
});

test("collectTaskLinks filters concrete task urls from mixed assignment candidates", () => {
  const links = collectTaskLinks([
    {
      text: "作业",
      href: "https://mooc1.chaoxing.com/mooc2/work/list",
    },
    {
      text: "作业20260529",
      href: "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=1&workId=2",
    },
  ]);

  assert.deepEqual(links, [
    {
      text: "作业20260529",
      href: "https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?courseId=1&workId=2",
    },
  ]);
});

test("collectCourseEntryLinks filters and dedupes course entries", () => {
  const links = collectCourseEntryLinks([
    {
      text: "",
      href: "https://mooc1-1.chaoxing.com/mooc-ans/visit/stucoursemiddle?courseid=1&clazzid=2",
    },
    {
      text: "duplicate",
      href: "https://mooc1-1.chaoxing.com/mooc-ans/visit/stucoursemiddle?courseid=1&clazzid=2",
    },
    {
      text: "作业",
      href: "https://mooc1.chaoxing.com/work/list",
    },
  ]);

  assert.deepEqual(links, [
    {
      text: "",
      href: "https://mooc1-1.chaoxing.com/mooc-ans/visit/stucoursemiddle?courseid=1&clazzid=2",
    },
  ]);
});

test("selectCourseEntry chooses by index or fuzzy keyword", () => {
  const courses = [
    { index: 1, title: "大学英语" },
    { index: 2, title: "思想道德与法治" },
    { index: 3, title: "毛泽东思想和中国特色社会主义理论体系概论" },
  ];

  assert.deepEqual(selectCourseEntry(courses, "2"), courses[1]);
  assert.deepEqual(selectCourseEntry(courses, "毛概"), courses[2]);
  assert.equal(selectCourseEntry(courses, "不存在"), undefined);
});

test("resolveCourseQueryInput defaults blank input to first course", () => {
  assert.equal(resolveCourseQueryInput(""), "1");
  assert.equal(resolveCourseQueryInput("   "), "1");
  assert.equal(resolveCourseQueryInput("毛概"), "毛概");
  assert.equal(resolveCourseQueryInput("2"), "2");
});

test("filenameForAssignment creates stable safe filenames", () => {
  assert.equal(
    filenameForAssignment("习毛概 第 1 次作业: 为什么?"),
    "习毛概 第 1 次作业 为什么",
  );

  assert.equal(filenameForAssignment(""), "assignment");
});

test("buildReviewMarkdown includes source and extracted body", () => {
  const markdown = buildReviewMarkdown({
    title: "第 1 次作业",
    sourceUrl: "https://example.com/work/1",
    bodyMarkdown: "题目内容",
  });

  assert.equal(
    markdown,
    "# 第 1 次作业\n\n题目内容\n",
  );
});

test("isReadyToReadUrl recognizes post-login Chaoxing pages", () => {
  assert.equal(isReadyToReadUrl("https://i.chaoxing.com/base?t=1"), true);
  assert.equal(isReadyToReadUrl("https://mooc1-1.chaoxing.com/visit/interaction?s=1"), true);
  assert.equal(isReadyToReadUrl("https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu?courseid=1"), true);
  assert.equal(isReadyToReadUrl("https://passport2.chaoxing.com/login"), false);
});

test("resolveLoginQrImageUrl resolves Chaoxing QR image src values", () => {
  assert.equal(
    resolveLoginQrImageUrl(
      "/createqr?uuid=469f8b5a7c4c41a8bffffae0057c0393&fid=-1",
      "https://passport2.chaoxing.com/login?fid=-1",
    ),
    "https://passport2.chaoxing.com/createqr?uuid=469f8b5a7c4c41a8bffffae0057c0393&fid=-1",
  );

  assert.equal(
    resolveLoginQrImageUrl(
      "//passport2.chaoxing.com/createqr?uuid=abc&fid=-1",
      "https://passport2.chaoxing.com/login",
    ),
    "https://passport2.chaoxing.com/createqr?uuid=abc&fid=-1",
  );

  assert.equal(resolveLoginQrImageUrl("javascript:void(0)", "https://passport2.chaoxing.com/login"), "");
});
