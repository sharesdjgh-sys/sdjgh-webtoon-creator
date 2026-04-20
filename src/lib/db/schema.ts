import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  json,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 사용자 테이블
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  school: varchar("school", { length: 200 }),
  grade: varchar("grade", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 웹툰 프로젝트 테이블
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  genre: varchar("genre", { length: 50 }),
  targetCompetition: varchar("target_competition", { length: 200 }),
  deadline: timestamp("deadline"),
  synopsis: text("synopsis"),
  currentStep: integer("current_step").default(1).notNull(), // 1~6단계
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 스토리 테이블
export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  logline: text("logline"), // 한 줄 요약
  theme: text("theme"), // 주제
  setting: text("setting"), // 배경/세계관
  plotOutline: text("plot_outline"), // 줄거리
  totalEpisodes: integer("total_episodes").default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 캐릭터 테이블
export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  role: varchar("role", { length: 50 }), // 주인공, 조력자, 악당 등
  age: varchar("age", { length: 20 }),
  appearance: text("appearance"), // 외모 설명
  personality: text("personality"), // 성격
  backstory: text("backstory"), // 배경 이야기
  imagePrompt: text("image_prompt"), // AI 이미지 생성 프롬프트
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 에피소드(화) 테이블
export const episodes = pgTable("episodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: varchar("title", { length: 200 }),
  synopsis: text("synopsis"), // 화 줄거리
  script: text("script"), // 대본
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 콘티 패널 테이블
export const panels = pgTable("panels", {
  id: uuid("id").defaultRandom().primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  panelNumber: integer("panel_number").notNull(),
  description: text("description"), // 장면 설명
  dialogue: text("dialogue"), // 대사
  angle: varchar("angle", { length: 50 }), // 앵글 (클로즈업, 와이드 등)
  layout: json("layout"), // 패널 레이아웃 데이터
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI 대화 기록 테이블
export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  step: varchar("step", { length: 50 }).notNull(), // 어느 단계에서의 대화인지
  messages: json("messages").notNull(), // 대화 내용 배열
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  story: one(stories, { fields: [projects.id], references: [stories.projectId] }),
  characters: many(characters),
  episodes: many(episodes),
  aiConversations: many(aiConversations),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  project: one(projects, { fields: [episodes.projectId], references: [projects.id] }),
  panels: many(panels),
}));
