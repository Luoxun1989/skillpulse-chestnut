# 四栏目拆表实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `weekly_digest_items` 单表拆成 4 张栏目专属表（news_item / paper_item / project_item / community_item），加爬虫字段，预留 metadata JSON，迁移 14 条历史 + 10 条 Skills 数据；公开 API 路径保持不变（后端 UNION），Admin 拆 24 个独立端点。

**Architecture:** 物理拆表 + 字段重复；公开 API 路径不变（`WeeklyDigestItemService` 内部根据 section 路由到对应表 mapper 或 UNION）；id 用 `{section}-{snowflake}` 前缀以支持按前缀直接命中单表；4 个独立 Admin Controller 取代单一 controller。

**Tech Stack:** Spring Boot 2.7.18 + MyBatis + MySQL 8 + Lombok + JUnit 5（后端测试）。

**Spec:** [docs/superpowers/specs/2026-09-21-section-tables-design.md](../specs/2026-09-21-section-tables-design.md)

**仓库边界：** 本计划只动 `skillpulse-api`（后端）+ `skillpulse-chestnut`（前端 type 兼容）；`skillpulse-crawler` 改造为后续独立 plan。

---

## 文件结构

### skillpulse-api（后端）

**新建**：
- `src/main/java/com/skillpulse/entity/NewsItem.java`
- `src/main/java/com/skillpulse/entity/PaperItem.java`
- `src/main/java/com/skillpulse/entity/ProjectItem.java`
- `src/main/java/com/skillpulse/entity/CommunityItem.java`
- `src/main/java/com/skillpulse/mapper/NewsItemMapper.java`
- `src/main/java/com/skillpulse/mapper/PaperItemMapper.java`
- `src/main/java/com/skillpulse/mapper/ProjectItemMapper.java`
- `src/main/java/com/skillpulse/mapper/CommunityItemMapper.java`
- `src/main/java/com/skillpulse/controller/admin/SectionAdminController.java`（4 个 section × 6 端点 = 24 端点合并到一个 controller）
- `src/main/resources/db/migration/V20260921__create_section_tables.sql`
- `src/main/resources/db/migration/V20260921__migrate_data.sql`

**修改**：
- `src/main/java/com/skillpulse/service/WeeklyDigestItemService.java`：内部改用 4 个新 mapper，UNION 由 4 个 mapper 调用结果合并
- `src/main/java/com/skillpulse/controller/WeeklyDigestController.java`：保持 URL 路径不变，实现内部路由
- `src/main/java/com/skillpulse/controller/admin/WeeklyDigestAdminController.java`：标记 `@Deprecated`，保留兼容
- `src/main/java/com/skillpulse/dto/BatchUpsertRequest.java`：加 `fetchStatus / fetchedAt / batchId / rawUrl` 字段
- `src/main/java/com/skillpulse/dto/ItemDto.java`：加同上字段

**删除**（在最终清理任务）：
- `src/main/java/com/skillpulse/entity/WeeklyDigestItem.java`（不删——保留作为 DTO 输出）
- `src/main/java/com/skillpulse/mapper/WeeklyDigestItemMapper.java`（保留 selectIdByNaturalKey + check-existence 共用）

**关键决策**：
- `WeeklyDigestItem` 保留作为**统一的输出 DTO**（4 张表的查询结果都映射成它），前端契约 0 改动
- 旧 `weekly_digest_items` 表保留（dev 观察 1 周后运维 drop），不在本计划删除
- id 生成：`{section}-{snowflake}` 格式；admin 入库时若 id 为空自动生成；迁移时按规则拼前缀

---

## Task 1：建 4 张表的 DDL 迁移文件

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\resources\db\migration\V20260921__create_section_tables.sql`

- [ ] **Step 1：编写 V20260921__create_section_tables.sql**

`D:\IdeaProjects\skillpulse-api\src\main\resources\db\migration\V20260921__create_section_tables.sql`：

```sql
-- 4 张栏目表同构，按 spec §3.1 + 附录 A 字段定义

CREATE TABLE news_item (
    id              VARCHAR(32)     NOT NULL,
    title           VARCHAR(512)    NOT NULL,
    summary         TEXT            NULL,
    url             VARCHAR(1024)   NOT NULL,
    source          VARCHAR(64)     NOT NULL,
    source_id       VARCHAR(128)    NOT NULL,
    stars           INT             NULL,
    comments_count  INT             NULL,
    likes_count     INT             NULL,
    published_date  DATE            NULL,
    issue_number    INT             NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    sort_order      INT             NOT NULL DEFAULT 0,
    fetch_status    VARCHAR(16)     NOT NULL DEFAULT 'success',
    fetched_at      DATETIME        NULL,
    batch_id        VARCHAR(64)     NULL,
    raw_url         VARCHAR(1024)   NULL,
    error_msg       VARCHAR(1024)   NULL,
    retry_count     INT             NOT NULL DEFAULT 0,
    metadata        JSON            NULL,
    created_at      DATETIME        NOT NULL,
    updated_at      DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_natural_key (source, source_id),
    KEY idx_active_issue_sort (is_active, issue_number, sort_order),
    KEY idx_published_date (published_date),
    KEY idx_fetch_status (fetch_status, fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE paper_item LIKE news_item;
CREATE TABLE project_item LIKE news_item;
CREATE TABLE community_item LIKE news_item;
```

- [ ] **Step 2：在 dev MySQL 上跑 DDL 验证**

执行：`mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse < V20260921__create_section_tables.sql`

Expected: 4 张表创建成功，索引齐全。

- [ ] **Step 3：SHOW CREATE TABLE 验证字段与索引**

执行：
```bash
mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse -e "SHOW CREATE TABLE news_item\G"
```

Expected: 输出包含 21 字段、5 索引（PRIMARY/uk_natural_key/idx_active_issue_sort/idx_published_date/idx_fetch_status）。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/resources/db/migration/V20260921__create_section_tables.sql
git commit -m "feat(db): 4 张栏目表 DDL（同构 + 爬虫字段 + 索引）"
```

---

## Task 2：建 4 个 Entity 类

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\NewsItem.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\PaperItem.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\ProjectItem.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\CommunityItem.java`

- [ ] **Step 1：写 NewsItem entity**

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\NewsItem.java`：

```java
package com.skillpulse.entity;

import lombok.Data;
import java.util.Date;

/**
 * 新闻栏目条目 - news_item
 * 字段定义见 spec 2026-09-21 §3.1
 */
@Data
public class NewsItem {
    private String id;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String sourceId;
    private Integer stars;
    private Integer commentsCount;
    private Integer likesCount;
    private Date publishedDate;
    private Integer issueNumber;
    private Integer isActive;
    private Integer sortOrder;
    private String fetchStatus;
    private Date fetchedAt;
    private String batchId;
    private String rawUrl;
    private String errorMsg;
    private Integer retryCount;
    private String metadata;
    private Date createdAt;
    private Date updatedAt;
}
```

- [ ] **Step 2：写 PaperItem / ProjectItem / CommunityItem entity**

3 个文件结构同 NewsItem，类名不同。每个独立文件，**不要共享基类**（spec §3.3 已决定不抽公共表）。

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\PaperItem.java`：
```java
package com.skillpulse.entity;

import lombok.Data;
import java.util.Date;

/** 论文栏目条目 - paper_item */
@Data
public class PaperItem {
    private String id;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String sourceId;
    private Integer stars;
    private Integer commentsCount;
    private Integer likesCount;
    private Date publishedDate;
    private Integer issueNumber;
    private Integer isActive;
    private Integer sortOrder;
    private String fetchStatus;
    private Date fetchedAt;
    private String batchId;
    private String rawUrl;
    private String errorMsg;
    private Integer retryCount;
    private String metadata;
    private Date createdAt;
    private Date updatedAt;
}
```

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\ProjectItem.java`：
```java
package com.skillpulse.entity;

import lombok.Data;
import java.util.Date;

/** 项目栏目条目 - project_item */
@Data
public class ProjectItem {
    private String id;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String sourceId;
    private Integer stars;
    private Integer commentsCount;
    private Integer likesCount;
    private Date publishedDate;
    private Integer issueNumber;
    private Integer isActive;
    private Integer sortOrder;
    private String fetchStatus;
    private Date fetchedAt;
    private String batchId;
    private String rawUrl;
    private String errorMsg;
    private Integer retryCount;
    private String metadata;
    private Date createdAt;
    private Date updatedAt;
}
```

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\entity\CommunityItem.java`：
```java
package com.skillpulse.entity;

import lombok.Data;
import java.util.Date;

/** 社区 Skills 栏目条目 - community_item */
@Data
public class CommunityItem {
    private String id;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String sourceId;
    private Integer stars;
    private Integer commentsCount;
    private Integer likesCount;
    private Date publishedDate;
    private Integer issueNumber;
    private Integer isActive;
    private Integer sortOrder;
    private String fetchStatus;
    private Date fetchedAt;
    private String batchId;
    private String rawUrl;
    private String errorMsg;
    private Integer retryCount;
    private String metadata;
    private Date createdAt;
    private Date updatedAt;
}
```

- [ ] **Step 3：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS，0 错误。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/entity/NewsItem.java \
        src/main/java/com/skillpulse/entity/PaperItem.java \
        src/main/java/com/skillpulse/entity/ProjectItem.java \
        src/main/java/com/skillpulse/entity/CommunityItem.java
git commit -m "feat(entity): 4 个栏目 entity 类（同构字段）"
```

---

## Task 3：建 4 个 Mapper（每表标准 CRUD + 公共查询）

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\NewsItemMapper.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\PaperItemMapper.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\ProjectItemMapper.java`
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\CommunityItemMapper.java`

- [ ] **Step 1：写 NewsItemMapper**

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\NewsItemMapper.java`：

```java
package com.skillpulse.mapper;

import com.skillpulse.entity.NewsItem;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface NewsItemMapper {

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM news_item WHERE is_active = 1 " +
            "<if test='issueNumber != null'>AND issue_number = #{issueNumber}</if> " +
            "ORDER BY sort_order ASC, created_at DESC LIMIT #{limit}")
    List<NewsItem> selectActiveByIssue(@Param("issueNumber") Integer issueNumber,
                                       @Param("limit") int limit);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM news_item WHERE id = #{id}")
    NewsItem selectById(@Param("id") String id);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM news_item " +
            "WHERE (title LIKE CONCAT('%', #{q}, '%') OR source LIKE CONCAT('%', #{q}, '%')) " +
            "ORDER BY published_date DESC LIMIT #{limit}")
    List<NewsItem> search(@Param("q") String q, @Param("limit") int limit);

    @Select("SELECT id FROM news_item WHERE source = #{source} AND source_id = #{sourceId} LIMIT 1")
    String selectIdByNaturalKey(@Param("source") String source,
                                @Param("sourceId") String sourceId);

    @Insert("INSERT INTO news_item (id, title, summary, url, source, source_id, stars, " +
            "comments_count, likes_count, published_date, issue_number, is_active, sort_order, " +
            "fetch_status, fetched_at, batch_id, raw_url, error_msg, retry_count, metadata, " +
            "created_at, updated_at) " +
            "VALUES (#{id}, #{title}, #{summary}, #{url}, #{source}, #{sourceId}, #{stars}, " +
            "#{commentsCount}, #{likesCount}, #{publishedDate}, #{issueNumber}, #{isActive}, #{sortOrder}, " +
            "#{fetchStatus}, #{fetchedAt}, #{batchId}, #{rawUrl}, #{errorMsg}, #{retryCount}, #{metadata}, " +
            "NOW(), NOW())")
    void insert(NewsItem item);

    @Update("UPDATE news_item SET title=#{title}, summary=#{summary}, url=#{url}, source=#{source}, " +
            "source_id=#{sourceId}, stars=#{stars}, comments_count=#{commentsCount}, " +
            "likes_count=#{likesCount}, published_date=#{publishedDate}, issue_number=#{issueNumber}, " +
            "is_active=#{isActive}, sort_order=#{sortOrder}, fetch_status=#{fetchStatus}, " +
            "fetched_at=#{fetchedAt}, batch_id=#{batchId}, raw_url=#{rawUrl}, error_msg=#{errorMsg}, " +
            "retry_count=#{retryCount}, metadata=#{metadata}, updated_at=NOW() WHERE id=#{id}")
    void update(NewsItem item);

    @Delete("DELETE FROM news_item WHERE id = #{id}")
    void deleteById(@Param("id") String id);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM news_item " +
            "<where>" +
            "  <if test='search != null and search != \"\"'>AND (title LIKE CONCAT('%', #{search}, '%') OR source LIKE CONCAT('%', #{search}, '%'))</if>" +
            "</where>" +
            "ORDER BY issue_number DESC, sort_order ASC, created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<NewsItem> selectAll(@Param("offset") int offset,
                             @Param("limit") int limit,
                             @Param("search") String search);

    @Select("SELECT COUNT(*) FROM news_item " +
            "<where>" +
            "  <if test='search != null and search != \"\"'>AND (title LIKE CONCAT('%', #{search}, '%') OR source LIKE CONCAT('%', #{search}, '%'))</if>" +
            "</where>")
    int countAll(@Param("search") String search);
}
```

- [ ] **Step 2：复制并改写 PaperItem / ProjectItem / CommunityItem mapper**

每个 mapper 类名不同、SQL 字段完全一致（因为表同构），只需全局替换 4 处：
- `NewsItem` → `PaperItem` / `ProjectItem` / `CommunityItem`
- `news_item` → `paper_item` / `project_item` / `community_item`

完整 mapper 文件示例（PaperItem）：

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\mapper\PaperItemMapper.java`：

```java
package com.skillpulse.mapper;

import com.skillpulse.entity.PaperItem;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface PaperItemMapper {

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM paper_item WHERE is_active = 1 " +
            "<if test='issueNumber != null'>AND issue_number = #{issueNumber}</if> " +
            "ORDER BY sort_order ASC, created_at DESC LIMIT #{limit}")
    List<PaperItem> selectActiveByIssue(@Param("issueNumber") Integer issueNumber,
                                        @Param("limit") int limit);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM paper_item WHERE id = #{id}")
    PaperItem selectById(@Param("id") String id);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM paper_item " +
            "WHERE (title LIKE CONCAT('%', #{q}, '%') OR source LIKE CONCAT('%', #{q}, '%')) " +
            "ORDER BY published_date DESC LIMIT #{limit}")
    List<PaperItem> search(@Param("q") String q, @Param("limit") int limit);

    @Select("SELECT id FROM paper_item WHERE source = #{source} AND source_id = #{sourceId} LIMIT 1")
    String selectIdByNaturalKey(@Param("source") String source,
                                @Param("sourceId") String sourceId);

    @Insert("INSERT INTO paper_item (id, title, summary, url, source, source_id, stars, " +
            "comments_count, likes_count, published_date, issue_number, is_active, sort_order, " +
            "fetch_status, fetched_at, batch_id, raw_url, error_msg, retry_count, metadata, " +
            "created_at, updated_at) " +
            "VALUES (#{id}, #{title}, #{summary}, #{url}, #{source}, #{sourceId}, #{stars}, " +
            "#{commentsCount}, #{likesCount}, #{publishedDate}, #{issueNumber}, #{isActive}, #{sortOrder}, " +
            "#{fetchStatus}, #{fetchedAt}, #{batchId}, #{rawUrl}, #{errorMsg}, #{retryCount}, #{metadata}, " +
            "NOW(), NOW())")
    void insert(PaperItem item);

    @Update("UPDATE paper_item SET title=#{title}, summary=#{summary}, url=#{url}, source=#{source}, " +
            "source_id=#{sourceId}, stars=#{stars}, comments_count=#{commentsCount}, " +
            "likes_count=#{likesCount}, published_date=#{publishedDate}, issue_number=#{issueNumber}, " +
            "is_active=#{isActive}, sort_order=#{sortOrder}, fetch_status=#{fetchStatus}, " +
            "fetched_at=#{fetchedAt}, batch_id=#{batchId}, raw_url=#{rawUrl}, error_msg=#{errorMsg}, " +
            "retry_count=#{retryCount}, metadata=#{metadata}, updated_at=NOW() WHERE id=#{id}")
    void update(PaperItem item);

    @Delete("DELETE FROM paper_item WHERE id = #{id}")
    void deleteById(@Param("id") String id);

    @Select("SELECT id, title, summary, url, source, source_id AS sourceId, stars, " +
            "comments_count AS commentsCount, likes_count AS likesCount, published_date AS publishedDate, " +
            "issue_number AS issueNumber, is_active AS isActive, sort_order AS sortOrder, " +
            "fetch_status AS fetchStatus, fetched_at AS fetchedAt, batch_id AS batchId, " +
            "raw_url AS rawUrl, error_msg AS errorMsg, retry_count AS retryCount, metadata, " +
            "created_at AS createdAt, updated_at AS updatedAt " +
            "FROM paper_item " +
            "<where>" +
            "  <if test='search != null and search != \"\"'>AND (title LIKE CONCAT('%', #{search}, '%') OR source LIKE CONCAT('%', #{search}, '%'))</if>" +
            "</where>" +
            "ORDER BY issue_number DESC, sort_order ASC, created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<PaperItem> selectAll(@Param("offset") int offset,
                              @Param("limit") int limit,
                              @Param("search") String search);

    @Select("SELECT COUNT(*) FROM paper_item " +
            "<where>" +
            "  <if test='search != null and search != \"\"'>AND (title LIKE CONCAT('%', #{search}, '%') OR source LIKE CONCAT('%', #{search}, '%'))</if>" +
            "</where>")
    int countAll(@Param("search") String search);
}
```

照此分别写 ProjectItemMapper.java 和 CommunityItemMapper.java（替换类名 + 表名）。

- [ ] **Step 3：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS，0 错误。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/mapper/NewsItemMapper.java \
        src/main/java/com/skillpulse/mapper/PaperItemMapper.java \
        src/main/java/com/skillpulse/mapper/ProjectItemMapper.java \
        src/main/java/com/skillpulse/mapper/CommunityItemMapper.java
git commit -m "feat(mapper): 4 个栏目 mapper（selectActiveByIssue/selectById/search/insert/update/delete/selectAll）"
```

---

## Task 4：扩展 DTO 接收爬虫字段

**Files:**
- Modify: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\dto\ItemDto.java`
- Modify: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\dto\BatchUpsertRequest.java`

- [ ] **Step 1：看当前 ItemDto 字段**

执行：`cat D:/IdeaProjects/skillpulse-api/src/main/java/com/skillpulse/dto/ItemDto.java`

确认现有字段：section / title / summary / url / source / sourceId / stars / commentsCount / likesCount / publishedDate / sortOrder。

- [ ] **Step 2：扩展 ItemDto 加爬虫字段**

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\dto\ItemDto.java`（完整重写）：

```java
package com.skillpulse.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import java.util.Date;

/**
 * Crawler 单条入库 DTO
 * spec 2026-09-21 §3.1：含爬虫字段 fetchStatus/fetchedAt/batchId/rawUrl/retryCount/errorMsg
 */
@Data
public class ItemDto {
    private String section;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String sourceId;
    private Integer stars;
    private Integer commentsCount;
    private Integer likesCount;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date publishedDate;
    private Integer sortOrder;

    /** 爬虫字段（spec §3.1） */
    private String fetchStatus;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date fetchedAt;
    private String batchId;
    private String rawUrl;
    private String errorMsg;
    private Integer retryCount;

    /** 栏目特有字段（spec §3.2） */
    private String metadata;
}
```

- [ ] **Step 3：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/dto/ItemDto.java
git commit -m "feat(dto): ItemDto 加爬虫字段（fetchStatus/batchId/rawUrl/retryCount/errorMsg）+ metadata"
```

---

## Task 5：SectionService（核心服务，UNION 4 表 + section 路由）

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\service\SectionService.java`

- [ ] **Step 1：写 SectionService 框架**

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\service\SectionService.java`：

```java
package com.skillpulse.service;

import com.skillpulse.entity.*;
import com.skillpulse.mapper.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * 4 栏目核心服务 - spec 2026-09-21 §6.1 §6.2
 * - 公开 API 内部路由到对应表
 * - id 前缀 {section}- 命中单表
 * - 跨表操作（issues/search/listAll）走 UNION
 */
@Service
public class SectionService {

    private static final Logger log = LoggerFactory.getLogger(SectionService.class);

    public static final String SECTION_NEWS = "news";
    public static final String SECTION_PAPER = "paper";
    public static final String SECTION_PROJECT = "project";
    public static final String SECTION_COMMUNITY = "community";

    private static final Set<String> VALID_SECTIONS =
            Set.of(SECTION_NEWS, SECTION_PAPER, SECTION_PROJECT, SECTION_COMMUNITY);

    private final NewsItemMapper newsMapper;
    private final PaperItemMapper paperMapper;
    private final ProjectItemMapper projectMapper;
    private final CommunityItemMapper communityMapper;

    @Autowired
    public SectionService(NewsItemMapper newsMapper,
                          PaperItemMapper paperMapper,
                          ProjectItemMapper projectMapper,
                          CommunityItemMapper communityMapper) {
        this.newsMapper = newsMapper;
        this.paperMapper = paperMapper;
        this.projectMapper = projectMapper;
        this.communityMapper = communityMapper;
    }

    /** 校验 section 合法性，非法抛 IllegalArgumentException（spec §9 风险缓解） */
    public static void validateSection(String section) {
        if (section == null || !VALID_SECTIONS.contains(section)) {
            throw new IllegalArgumentException("非法 section: " + section);
        }
    }

    /** 从 id 前缀提取 section，找不到返回 null */
    public static String extractSection(String id) {
        if (id == null) return null;
        int idx = id.indexOf('-');
        if (idx < 1) return null;
        String prefix = id.substring(0, idx);
        return VALID_SECTIONS.contains(prefix) ? prefix : null;
    }

    /** 公开：按栏目 + issue 查上架内容 */
    public List<WeeklyDigestItem> listBySection(String section, Integer issueNumber, int limit) {
        validateSection(section);
        Integer effectiveIssue = issueNumber;
        if (effectiveIssue == null) {
            effectiveIssue = selectLatestIssueNumber();
            if (effectiveIssue == null) {
                return new ArrayList<>();
            }
        }
        List<? extends WeeklyDigestItemSource> rows = switch (section) {
            case SECTION_NEWS -> newsMapper.selectActiveByIssue(effectiveIssue, limit);
            case SECTION_PAPER -> paperMapper.selectActiveByIssue(effectiveIssue, limit);
            case SECTION_PROJECT -> projectMapper.selectActiveByIssue(effectiveIssue, limit);
            case SECTION_COMMUNITY -> communityMapper.selectActiveByIssue(effectiveIssue, limit);
            default -> throw new IllegalArgumentException("非法 section: " + section);
        };
        return toDtoList(rows);
    }

    /** 公开：所有期号（UNION 4 表 DISTINCT issue_number） */
    public List<Integer> listIssueNumbers() {
        // 简化：unionDistinctIssue 实现见 Step 2
        return unionDistinctIssue();
    }

    /** 公开：全库搜索（UNION 4 表 title/source LIKE） */
    public List<WeeklyDigestItem> search(String q, int limit) {
        if (q == null || q.trim().isEmpty()) {
            return new ArrayList<>();
        }
        String kw = q.trim();
        List<WeeklyDigestItem> all = new ArrayList<>();
        all.addAll(toDtoList(newsMapper.search(kw, limit)));
        all.addAll(toDtoList(paperMapper.search(kw, limit)));
        all.addAll(toDtoList(projectMapper.search(kw, limit)));
        all.addAll(toDtoList(communityMapper.search(kw, limit)));
        // 按 published_date 降序（如有），否则保持插入顺序
        all.sort((a, b) -> {
            if (a.getPublishedDate() == null && b.getPublishedDate() == null) return 0;
            if (a.getPublishedDate() == null) return 1;
            if (b.getPublishedDate() == null) return -1;
            return b.getPublishedDate().compareTo(a.getPublishedDate());
        });
        if (all.size() > limit) {
            return all.subList(0, limit);
        }
        return all;
    }

    /** 公开：按 id 查（spec §6.2：按前缀拆 section 直接查单表） */
    public WeeklyDigestItem getById(String id) {
        String section = extractSection(id);
        if (section == null) {
            return null;
        }
        WeeklyDigestItemSource row = switch (section) {
            case SECTION_NEWS -> newsMapper.selectById(id);
            case SECTION_PAPER -> paperMapper.selectById(id);
            case SECTION_PROJECT -> projectMapper.selectById(id);
            case SECTION_COMMUNITY -> communityMapper.selectById(id);
            default -> null;
        };
        return row == null ? null : toDto(row);
    }

    /** Admin：按 id 查（含未上架） */
    public WeeklyDigestItem getByIdAny(String id) {
        return getById(id); // 当前 4 表 mapper 无 is_active 过滤，行为一致
    }

    /** Admin：分页列表（按 section） */
    public List<WeeklyDigestItem> listAll(int offset, int limit, String section, String search) {
        if (section != null && !section.isEmpty()) {
            validateSection(section);
            List<? extends WeeklyDigestItemSource> rows = switch (section) {
                case SECTION_NEWS -> newsMapper.selectAll(offset, limit, search);
                case SECTION_PAPER -> paperMapper.selectAll(offset, limit, search);
                case SECTION_PROJECT -> projectMapper.selectAll(offset, limit, search);
                case SECTION_COMMUNITY -> communityMapper.selectAll(offset, limit, search);
                default -> throw new IllegalArgumentException("非法 section: " + section);
            };
            return toDtoList(rows);
        }
        // 不指定 section → 4 表合并
        List<WeeklyDigestItem> all = new ArrayList<>();
        all.addAll(toDtoList(newsMapper.selectAll(offset, limit, search)));
        all.addAll(toDtoList(paperMapper.selectAll(offset, limit, search)));
        all.addAll(toDtoList(projectMapper.selectAll(offset, limit, search)));
        all.addAll(toDtoList(communityMapper.selectAll(offset, limit, search)));
        return all;
    }

    public int countAll(String section, String search) {
        if (section != null && !section.isEmpty()) {
            validateSection(section);
            return switch (section) {
                case SECTION_NEWS -> newsMapper.countAll(search);
                case SECTION_PAPER -> paperMapper.countAll(search);
                case SECTION_PROJECT -> projectMapper.countAll(search);
                case SECTION_COMMUNITY -> communityMapper.countAll(search);
                default -> 0;
            };
        }
        return newsMapper.countAll(search)
                + paperMapper.countAll(search)
                + projectMapper.countAll(search)
                + communityMapper.countAll(search);
    }

    /** Admin：新建 */
    public String create(String section, WeeklyDigestItem item) {
        validateSection(section);
        if (item.getId() == null || item.getId().isEmpty()) {
            item.setId(section + "-" + generateShortId());
        }
        applyDefaults(item);
        insertBySection(section, item);
        return item.getId();
    }

    /** Admin：更新 */
    public void update(String id, WeeklyDigestItem item) {
        String section = extractSection(id);
        if (section == null) {
            throw new IllegalArgumentException("非法 id 前缀: " + id);
        }
        item.setId(id);
        insertBySection(section, item); // 复用 insert SQL？改用 update SQL
        // 注：上方 insertBySection 实际是 INSERT，要换成 update 调用
    }

    /** Admin：删除 */
    public void delete(String id) {
        String section = extractSection(id);
        if (section == null) return;
        switch (section) {
            case SECTION_NEWS -> newsMapper.deleteById(id);
            case SECTION_PAPER -> paperMapper.deleteById(id);
            case SECTION_PROJECT -> projectMapper.deleteById(id);
            case SECTION_COMMUNITY -> communityMapper.deleteById(id);
        }
    }

    /** 检查存在性（爬虫去重） */
    public boolean existsByNaturalKey(String section, String source, String sourceId) {
        validateSection(section);
        String id = switch (section) {
            case SECTION_NEWS -> newsMapper.selectIdByNaturalKey(source, sourceId);
            case SECTION_PAPER -> paperMapper.selectIdByNaturalKey(source, sourceId);
            case SECTION_PROJECT -> projectMapper.selectIdByNaturalKey(source, sourceId);
            case SECTION_COMMUNITY -> communityMapper.selectIdByNaturalKey(source, sourceId);
            default -> null;
        };
        return id != null;
    }

    /** 生成新 id（section- 短随机串） */
    public static String generateShortId() {
        return java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private void applyDefaults(WeeklyDigestItem item) {
        if (item.getIsActive() == null) item.setIsActive(1);
        if (item.getSortOrder() == null) item.setSortOrder(0);
        if (item.getFetchStatus() == null) item.setFetchStatus("success");
        if (item.getRetryCount() == null) item.setRetryCount(0);
    }

    private void insertBySection(String section, WeeklyDigestItem item) {
        switch (section) {
            case SECTION_NEWS -> newsMapper.insert(toNews(item));
            case SECTION_PAPER -> paperMapper.insert(toPaper(item));
            case SECTION_PROJECT -> projectMapper.insert(toProject(item));
            case SECTION_COMMUNITY -> communityMapper.insert(toCommunity(item));
        }
    }

    private Integer selectLatestIssueNumber() {
        // 实现见 Step 2
        return null;
    }

    private List<Integer> unionDistinctIssue() {
        // 实现见 Step 2
        return new ArrayList<>();
    }

    // ---- 实体互转 ----

    private WeeklyDigestItem toDto(WeeklyDigestItemSource s) {
        WeeklyDigestItem d = new WeeklyDigestItem();
        d.setId(s.getId());
        d.setTitle(s.getTitle());
        d.setSummary(s.getSummary());
        d.setUrl(s.getUrl());
        d.setSource(s.getSource());
        d.setSourceId(s.getSourceId());
        d.setStars(s.getStars());
        d.setCommentsCount(s.getCommentsCount());
        d.setLikesCount(s.getLikesCount());
        d.setPublishedDate(s.getPublishedDate());
        d.setIssueNumber(s.getIssueNumber());
        d.setIsActive(s.getIsActive());
        d.setSortOrder(s.getSortOrder());
        d.setFetchStatus(s.getFetchStatus());
        d.setFetchedAt(s.getFetchedAt());
        d.setBatchId(s.getBatchId());
        d.setRawUrl(s.getRawUrl());
        d.setErrorMsg(s.getErrorMsg());
        d.setRetryCount(s.getRetryCount());
        return d;
    }

    private List<WeeklyDigestItem> toDtoList(List<? extends WeeklyDigestItemSource> src) {
        List<WeeklyDigestItem> out = new ArrayList<>(src.size());
        for (WeeklyDigestItemSource s : src) {
            out.add(toDto(s));
        }
        return out;
    }

    private NewsItem toNews(WeeklyDigestItem d) {
        NewsItem n = new NewsItem();
        copyFields(d, n);
        return n;
    }
    private PaperItem toPaper(WeeklyDigestItem d) {
        PaperItem p = new PaperItem();
        copyFields(d, p);
        return p;
    }
    private ProjectItem toProject(WeeklyDigestItem d) {
        ProjectItem p = new ProjectItem();
        copyFields(d, p);
        return p;
    }
    private CommunityItem toCommunity(WeeklyDigestItem d) {
        CommunityItem c = new CommunityItem();
        copyFields(d, c);
        return c;
    }

    private void copyFields(WeeklyDigestItem d, WeeklyDigestItemSource t) {
        t.setId(d.getId());
        t.setTitle(d.getTitle());
        t.setSummary(d.getSummary());
        t.setUrl(d.getUrl());
        t.setSource(d.getSource());
        t.setSourceId(d.getSourceId());
        t.setStars(d.getStars());
        t.setCommentsCount(d.getCommentsCount());
        t.setLikesCount(d.getLikesCount());
        t.setPublishedDate(d.getPublishedDate());
        t.setIssueNumber(d.getIssueNumber());
        t.setIsActive(d.getIsActive());
        t.setSortOrder(d.getSortOrder());
        t.setFetchStatus(d.getFetchStatus());
        t.setFetchedAt(d.getFetchedAt());
        t.setBatchId(d.getBatchId());
        t.setRawUrl(d.getRawUrl());
        t.setErrorMsg(d.getErrorMsg());
        t.setRetryCount(d.getRetryCount());
        // metadata 字段在 mapper JSON 列里，通过原生 SQL 处理；DTO 暂不传出 metadata
    }

    /** 4 个 entity 共同接口（便于泛型） */
    public interface WeeklyDigestItemSource {
        String getId();
        String getTitle();
        String getSummary();
        String getUrl();
        String getSource();
        String getSourceId();
        Integer getStars();
        Integer getCommentsCount();
        Integer getLikesCount();
        java.util.Date getPublishedDate();
        Integer getIssueNumber();
        Integer getIsActive();
        Integer getSortOrder();
        String getFetchStatus();
        java.util.Date getFetchedAt();
        String getBatchId();
        String getRawUrl();
        String getErrorMsg();
        Integer getRetryCount();

        void setId(String id);
        void setTitle(String title);
        void setSummary(String summary);
        void setUrl(String url);
        void setSource(String source);
        void setSourceId(String sourceId);
        void setStars(Integer stars);
        void setCommentsCount(Integer commentsCount);
        void setLikesCount(Integer likesCount);
        void setPublishedDate(java.util.Date publishedDate);
        void setIssueNumber(Integer issueNumber);
        void setIsActive(Integer isActive);
        void setSortOrder(Integer sortOrder);
        void setFetchStatus(String fetchStatus);
        void setFetchedAt(java.util.Date fetchedAt);
        void setBatchId(String batchId);
        void setRawUrl(String rawUrl);
        void setErrorMsg(String errorMsg);
        void setRetryCount(Integer retryCount);
    }
}
```

- [ ] **Step 2：让 NewsItem / PaperItem / ProjectItem / CommunityItem 实现 WeeklyDigestItemSource 接口**

每个 entity 文件加 `implements WeeklyService.WeeklyDigestItemSource`，并把 @Data 提供的 getter/setter 与接口一一对应（编译会自动验证）。

修改 4 个 entity 类签名：
```java
public class NewsItem implements SectionService.WeeklyDigestItemSource {
```

注：NewsItem 等已用 Lombok @Data 生成所有 getter/setter，自动满足接口契约。

- [ ] **Step 3：实现 selectLatestIssueNumber 与 unionDistinctIssue**

新增 4 个 mapper 的方法：

每个 mapper 加：
```java
@Select("SELECT MAX(issue_number) FROM {table_name} WHERE is_active = 1")
Integer selectLatestIssueNumber();

@Select("SELECT DISTINCT issue_number FROM {table_name} WHERE is_active = 1 ORDER BY issue_number DESC")
List<Integer> selectIssueNumbers();
```

（每个 mapper 替换 `{table_name}` 为 news_item / paper_item / ...）

更新 SectionService 的私有方法：

```java
private Integer selectLatestIssueNumber() {
    Integer max = null;
    for (Integer n : Arrays.asList(
            newsMapper.selectLatestIssueNumber(),
            paperMapper.selectLatestIssueNumber(),
            projectMapper.selectLatestIssueNumber(),
            communityMapper.selectLatestIssueNumber())) {
        if (n != null && (max == null || n > max)) max = n;
    }
    return max;
}

private List<Integer> unionDistinctIssue() {
    Set<Integer> set = new java.util.TreeSet<>(java.util.Collections.reverseOrder());
    set.addAll(newsMapper.selectIssueNumbers());
    set.addAll(paperMapper.selectIssueNumbers());
    set.addAll(projectMapper.selectIssueNumbers());
    set.addAll(communityMapper.selectIssueNumbers());
    return new ArrayList<>(set);
}
```

- [ ] **Step 4：修复 update() 实现——使用 update SQL 而非 insert**

修改 SectionService.update：

```java
public void update(String id, WeeklyDigestItem item) {
    String section = extractSection(id);
    if (section == null) {
        throw new IllegalArgumentException("非法 id 前缀: " + id);
    }
    item.setId(id);
    applyDefaults(item);
    switch (section) {
        case SECTION_NEWS -> newsMapper.update(toNews(item));
        case SECTION_PAPER -> paperMapper.update(toPaper(item));
        case SECTION_PROJECT -> projectMapper.update(toProject(item));
        case SECTION_COMMUNITY -> communityMapper.update(toCommunity(item));
    }
}
```

- [ ] **Step 5：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS，0 错误。

- [ ] **Step 6：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/service/SectionService.java \
        src/main/java/com/skillpulse/entity/NewsItem.java \
        src/main/java/com/skillpulse/entity/PaperItem.java \
        src/main/java/com/skillpulse/entity/ProjectItem.java \
        src/main/java/com/skillpulse/entity/CommunityItem.java \
        src/main/java/com/skillpulse/mapper/NewsItemMapper.java \
        src/main/java/com/skillpulse/mapper/PaperItemMapper.java \
        src/main/java/com/skillpulse/mapper/ProjectItemMapper.java \
        src/main/java/com/skillpulse/mapper/CommunityItemMapper.java
git commit -m "feat(service): SectionService UNION 4 表 + section/id 前缀路由"
```

---

## Task 6：写 SectionService 单元测试（JUnit 5 + 内存 MySQL 模拟）

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\test\java\com\skillpulse\service\SectionServiceTest.java`

- [ ] **Step 1：检查后端是否已有测试目录**

执行：`ls D:/IdeaProjects/skillpulse-api/src/test/ 2>/dev/null || echo "no test dir"`

若不存在，跳过 Spring 集成测试，改用纯单元测试覆盖核心方法（`validateSection` / `extractSection`）。

- [ ] **Step 2：写单元测试**

`D:\IdeaProjects\skillpulse-api\src\test\java\com\skillpulse\service\SectionServiceTest.java`：

```java
package com.skillpulse.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SectionServiceTest {

    @Test
    void validateSection_acceptsAllValidSections() {
        for (String s : new String[]{"news", "paper", "project", "community"}) {
            assertDoesNotThrow(() -> SectionService.validateSection(s));
        }
    }

    @Test
    void validateSection_rejectsNullAndUnknown() {
        assertThrows(IllegalArgumentException.class, () -> SectionService.validateSection(null));
        assertThrows(IllegalArgumentException.class, () -> SectionService.validateSection(""));
        assertThrows(IllegalArgumentException.class, () -> SectionService.validateSection("video"));
        assertThrows(IllegalArgumentException.class, () -> SectionService.validateSection("NEWS")); // case-sensitive
    }

    @Test
    void extractSection_parsesPrefixedId() {
        assertEquals("news", SectionService.extractSection("news-1891234567890123456"));
        assertEquals("paper", SectionService.extractSection("paper-abc123"));
        assertEquals("community", SectionService.extractSection("community-xyz"));
    }

    @Test
    void extractSection_returnsNullForUnprefixedOrUnknown() {
        assertNull(SectionService.extractSection(null));
        assertNull(SectionService.extractSection(""));
        assertNull(SectionService.extractSection("id-no-prefix"));
        assertNull(SectionService.extractSection("video-123"));
        assertNull(SectionService.extractSection("plain-id"));
    }

    @Test
    void generateShortId_returns16CharAlphanumeric() {
        String id = SectionService.generateShortId();
        assertEquals(16, id.length());
        assertTrue(id.matches("[0-9a-f]+"));
        // 不应包含横线
        assertFalse(id.contains("-"));
    }
}
```

- [ ] **Step 3：跑测试**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q test -Dtest=SectionServiceTest`

Expected: Tests run: 5, Failures: 0, Errors: 0。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/test/java/com/skillpulse/service/SectionServiceTest.java
git commit -m "test(section): SectionService 单元测试（validateSection/extractSection/generateShortId）"
```

---

## Task 7：更新公开 WeeklyDigestController 使用 SectionService

**Files:**
- Modify: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\WeeklyDigestController.java`

- [ ] **Step 1：重写 WeeklyDigestController**

完整重写 `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\WeeklyDigestController.java`：

```java
package com.skillpulse.controller;

import com.skillpulse.dto.ApiResponse;
import com.skillpulse.entity.WeeklyDigestItem;
import com.skillpulse.service.SectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 公开周刊接口 - 4 栏目拆表后保持路径兼容
 * 路径：/api/weekly-digest
 * 内部委托给 SectionService（按 spec §6.1 §6.2 实现 UNION）
 */
@RestController
@RequestMapping("/api/weekly-digest")
public class WeeklyDigestController {

    private final SectionService service;

    @Autowired
    public WeeklyDigestController(SectionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<WeeklyDigestItem>> listBySection(
            @RequestParam String section,
            @RequestParam(required = false) Integer issue,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.success(service.listBySection(section, issue, limit));
    }

    @GetMapping("/issues")
    public ApiResponse<List<Integer>> listIssues() {
        return ApiResponse.success(service.listIssueNumbers());
    }

    @GetMapping("/search")
    public ApiResponse<List<WeeklyDigestItem>> search(
            @RequestParam("q") String q,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(service.search(q, limit));
    }

    @GetMapping("/{id}")
    public ApiResponse<WeeklyDigestItem> getById(@PathVariable String id) {
        WeeklyDigestItem item = service.getById(id);
        if (item == null) {
            return ApiResponse.error("周刊内容不存在或已下架");
        }
        return ApiResponse.success(item);
    }
}
```

- [ ] **Step 2：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS。

- [ ] **Step 3：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/controller/WeeklyDigestController.java
git commit -m "refactor(controller): 公开 API 委托给 SectionService（路径不变）"
```

---

## Task 8：保留旧 AdminWeeklyDigestController 与 WeeklyDigestAdminController 兼容

**Files:**
- Modify: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\admin\AdminWeeklyDigestController.java`
- Modify: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\admin\WeeklyDigestAdminController.java`

- [ ] **Step 1：把两个旧 controller 委托给 SectionService，保持接口签名不变**

`AdminWeeklyDigestController.java` 修改：

```java
package com.skillpulse.controller.admin;

import com.skillpulse.dto.ApiResponse;
import com.skillpulse.dto.PaginatedResponse;
import com.skillpulse.entity.WeeklyDigestItem;
import com.skillpulse.service.SectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin 周刊管理（保留旧路径）— 4 栏目拆表后委托给 SectionService
 * 新代码请用 SectionAdminController（spec §7 24 端点）
 * @Deprecated 保留兼容，迁移期后删除
 */
@Deprecated
@RestController
@RequestMapping("/api/admin/weekly-digest")
public class AdminWeeklyDigestController {

    private final SectionService service;

    @Autowired
    public AdminWeeklyDigestController(SectionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PaginatedResponse<WeeklyDigestItem>> list(
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        int offset = (page - 1) * limit;
        List<WeeklyDigestItem> data = service.listAll(offset, limit, section, search);
        int total = service.countAll(section, search);
        int totalPages = (int) Math.ceil((double) total / limit);
        PaginatedResponse<WeeklyDigestItem> resp = new PaginatedResponse<>();
        resp.setData(data);
        resp.setTotal(total);
        resp.setPage(page);
        resp.setLimit(limit);
        resp.setTotalPages(totalPages);
        return ApiResponse.success(resp);
    }

    @GetMapping("/{id}")
    public ApiResponse<WeeklyDigestItem> getById(@PathVariable String id) {
        WeeklyDigestItem item = service.getByIdAny(id);
        return item == null ? ApiResponse.error("周刊内容不存在") : ApiResponse.success(item);
    }

    @PostMapping
    public ApiResponse<WeeklyDigestItem> create(@RequestBody WeeklyDigestItem item) {
        if (item.getSection() == null || item.getSection().isEmpty()) {
            return ApiResponse.error("栏目不能为空");
        }
        if (item.getTitle() == null || item.getTitle().isEmpty()) {
            return ApiResponse.error("标题不能为空");
        }
        if (item.getUrl() == null || item.getUrl().isEmpty()) {
            return ApiResponse.error("链接不能为空");
        }
        SectionService.validateSection(item.getSection());
        String id = service.create(item.getSection(), item);
        item.setId(id);
        return ApiResponse.success(item);
    }

    @PutMapping("/{id}")
    public ApiResponse<WeeklyDigestItem> update(@PathVariable String id, @RequestBody WeeklyDigestItem item) {
        if (service.getByIdAny(id) == null) {
            return ApiResponse.error("周刊内容不存在");
        }
        service.update(id, item);
        return ApiResponse.success(service.getByIdAny(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
```

`WeeklyDigestAdminController.java` 修改为兼容入口（保持 POST /items + GET /check-existence 路径，但内部按 section 路由）：

```java
package com.skillpulse.controller.admin;

import com.skillpulse.dto.ApiResponse;
import com.skillpulse.dto.BatchUpsertRequest;
import com.skillpulse.dto.UpsertResult;
import com.skillpulse.service.SectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 兼容入口：保留 POST /items + GET /check-existence
 * spec §7：迁移期保留，爬虫可继续用，新代码请走 SectionAdminController
 * @Deprecated 1 周观察期后删除
 */
@Deprecated
@RestController
@RequestMapping("/api/admin/weekly-digest")
public class WeeklyDigestAdminController {

    private final SectionService service;

    @Autowired
    public WeeklyDigestAdminController(SectionService service) {
        this.service = service;
    }

    @PostMapping("/items")
    public ApiResponse<UpsertResult> batchUpsert(@RequestBody BatchUpsertRequest request) {
        // 委托给 SectionService.batchUpsertBySection
        return ApiResponse.success(service.batchUpsertBySection(request));
    }

    @GetMapping("/check-existence")
    public ApiResponse<Boolean> checkExistence(@RequestParam String section,
                                                @RequestParam String source,
                                                @RequestParam("sourceId") String sourceId) {
        return ApiResponse.success(service.existsByNaturalKey(section, source, sourceId));
    }
}
```

- [ ] **Step 2：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS（但 SectionService.batchUpsertBySection 还没实现，会报错 → Step 3）。

- [ ] **Step 3：在 SectionService 实现 batchUpsertBySection**

加 SectionService 方法：

```java
public UpsertResult batchUpsertBySection(BatchUpsertRequest req) {
    UpsertResult result = new UpsertResult();
    if (req == null || req.getItems() == null || req.getItems().isEmpty()) {
        return result;
    }
    Integer issueNumber = req.getIssueNumber();
    if (issueNumber == null || issueNumber <= 0) {
        result.getErrors().add("issueNumber 必须为正整数");
        return result;
    }
    int order = 0;
    for (ItemDto dto : req.getItems()) {
        if (dto.getSection() == null || dto.getTitle() == null || dto.getUrl() == null
                || dto.getSource() == null || dto.getSourceId() == null) {
            result.getErrors().add("skip: 必填字段缺失");
            continue;
        }
        try {
            validateSection(dto.getSection());
        } catch (IllegalArgumentException e) {
            result.getErrors().add("skip: " + e.getMessage());
            continue;
        }
        // 自然键去重
        if (existsByNaturalKey(dto.getSection(), dto.getSource(), dto.getSourceId())) {
            result.setSkippedDuplicate(result.getSkippedDuplicate() + 1);
            continue;
        }
        WeeklyDigestItem item = new WeeklyDigestItem();
        item.setId(dto.getSection() + "-" + generateShortId());
        item.setSection(dto.getSection());
        item.setTitle(dto.getTitle());
        item.setSummary(dto.getSummary());
        item.setUrl(dto.getUrl());
        item.setSource(dto.getSource());
        item.setSourceId(dto.getSourceId());
        item.setStars(dto.getStars());
        item.setCommentsCount(dto.getCommentsCount());
        item.setLikesCount(dto.getLikesCount());
        item.setPublishedDate(dto.getPublishedDate());
        item.setIssueNumber(issueNumber);
        item.setIsActive(1);
        item.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : order++);
        // 爬虫字段
        item.setFetchStatus(dto.getFetchStatus() != null ? dto.getFetchStatus() : "success");
        item.setFetchedAt(dto.getFetchedAt() != null ? dto.getFetchedAt() : new java.util.Date());
        item.setBatchId(dto.getBatchId());
        item.setRawUrl(dto.getRawUrl());
        item.setErrorMsg(dto.getErrorMsg());
        item.setRetryCount(dto.getRetryCount() != null ? dto.getRetryCount() : 0);
        create(dto.getSection(), item);
        result.setInserted(result.getInserted() + 1);
    }
    log.info("batchUpsert 完成: inserted={}, skipped={}, errors={}",
            result.getInserted(), result.getSkippedDuplicate(), result.getErrors().size());
    return result;
}
```

- [ ] **Step 4：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS。

- [ ] **Step 5：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/controller/admin/AdminWeeklyDigestController.java \
        src/main/java/com/skillpulse/controller/admin/WeeklyDigestAdminController.java \
        src/main/java/com/skillpulse/service/SectionService.java
git commit -m "refactor(admin): 旧 Admin Controller 委托给 SectionService 保留兼容"
```

---

## Task 9：新建 SectionAdminController（4 section × 6 端点 = 24 端点）

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\admin\SectionAdminController.java`

- [ ] **Step 1：写 SectionAdminController**

`D:\IdeaProjects\skillpulse-api\src\main\java\com\skillpulse\controller\admin\SectionAdminController.java`：

```java
package com.skillpulse.controller.admin;

import com.skillpulse.dto.ApiResponse;
import com.skillpulse.dto.BatchUpsertRequest;
import com.skillpulse.dto.UpsertResult;
import com.skillpulse.entity.WeeklyDigestItem;
import com.skillpulse.service.SectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin 4 栏目独立端点（spec §7）
 * 路径：/api/admin/weekly-digest/{section}
 * 每个 section 6 个端点（list/get/create/update/delete/check-existence/batchUpsert）
 */
@RestController
@RequestMapping("/api/admin/weekly-digest/{section}")
public class SectionAdminController {

    private final SectionService service;

    @Autowired
    public SectionAdminController(SectionService service) {
        this.service = service;
    }

    /** 分页列表 */
    @GetMapping("/items")
    public ApiResponse<List<WeeklyDigestItem>> list(
            @PathVariable String section,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit) {
        SectionService.validateSection(section);
        int offset = (page - 1) * limit;
        return ApiResponse.success(service.listAll(offset, limit, section, search));
    }

    /** 详情 */
    @GetMapping("/items/{id}")
    public ApiResponse<WeeklyDigestItem> getById(@PathVariable String section, @PathVariable String id) {
        SectionService.validateSection(section);
        WeeklyDigestItem item = service.getByIdAny(id);
        return item == null ? ApiResponse.error("内容不存在") : ApiResponse.success(item);
    }

    /** 新增（单条） */
    @PostMapping("/items")
    public ApiResponse<WeeklyDigestItem> create(@PathVariable String section, @RequestBody WeeklyDigestItem item) {
        SectionService.validateSection(section);
        String id = service.create(section, item);
        item.setId(id);
        return ApiResponse.success(item);
    }

    /** 批量入库（Crawler 主用） */
    @PostMapping("/items/batch")
    public ApiResponse<UpsertResult> batchUpsert(@PathVariable String section,
                                                  @RequestBody BatchUpsertRequest request) {
        SectionService.validateSection(section);
        if (request == null) {
            return ApiResponse.error("请求体不能为空");
        }
        // 强制把每条 dto 的 section 设置为 path section，避免传入错误
        if (request.getItems() != null) {
            for (var dto : request.getItems()) {
                dto.setSection(section);
            }
        }
        return ApiResponse.success(service.batchUpsertBySection(request));
    }

    /** 更新 */
    @PutMapping("/items/{id}")
    public ApiResponse<WeeklyDigestItem> update(@PathVariable String section,
                                                 @PathVariable String id,
                                                 @RequestBody WeeklyDigestItem item) {
        SectionService.validateSection(section);
        service.update(id, item);
        return ApiResponse.success(service.getByIdAny(id));
    }

    /** 删除 */
    @DeleteMapping("/items/{id}")
    public ApiResponse<Void> delete(@PathVariable String section, @PathVariable String id) {
        SectionService.validateSection(section);
        service.delete(id);
        return ApiResponse.success(null);
    }

    /** 存在性预筛 */
    @GetMapping("/check-existence")
    public ApiResponse<Boolean> checkExistence(@PathVariable String section,
                                                @RequestParam String source,
                                                @RequestParam("sourceId") String sourceId) {
        SectionService.validateSection(section);
        return ApiResponse.success(service.existsByNaturalKey(section, source, sourceId));
    }
}
```

- [ ] **Step 2：编译验证**

执行：`cd D:/IdeaProjects/skillpulse-api && mvn -q compile`

Expected: BUILD SUCCESS。

- [ ] **Step 3：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/java/com/skillpulse/controller/admin/SectionAdminController.java
git commit -m "feat(admin): SectionAdminController 24 个独立端点（spec §7）"
```

---

## Task 10：写数据迁移脚本 V20260921__migrate_data.sql

**Files:**
- Create: `D:\IdeaProjects\skillpulse-api\src\main\resources\db\migration\V20260921__migrate_data.sql`

- [ ] **Step 1：写迁移 SQL**

`D:\IdeaProjects\skillpulse-api\src\main\resources\db\migration\V20260921__migrate_data.sql`：

```sql
-- 从老 weekly_digest_items 表按 section 拆分到 4 张新表
-- id 加前缀 {section}-，fetch_status='success', fetched_at=created_at, batch_id='migration-20260921'

INSERT INTO news_item (id, title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    fetch_status, fetched_at, batch_id, raw_url, error_msg, retry_count, metadata,
    created_at, updated_at)
SELECT
    CONCAT('news-', id) AS id,
    title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    'success' AS fetch_status,
    created_at AS fetched_at,
    'migration-20260921' AS batch_id,
    NULL AS raw_url,
    NULL AS error_msg,
    0 AS retry_count,
    NULL AS metadata,
    created_at, updated_at
FROM weekly_digest_items
WHERE section = 'news';

INSERT INTO paper_item (id, title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    fetch_status, fetched_at, batch_id, raw_url, error_msg, retry_count, metadata,
    created_at, updated_at)
SELECT
    CONCAT('paper-', id), title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    'success', created_at, 'migration-20260921', NULL, NULL, 0, NULL,
    created_at, updated_at
FROM weekly_digest_items
WHERE section = 'paper';

INSERT INTO project_item (id, title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    fetch_status, fetched_at, batch_id, raw_url, error_msg, retry_count, metadata,
    created_at, updated_at)
SELECT
    CONCAT('project-', id), title, summary, url, source, source_id, stars,
    comments_count, likes_count, published_date, issue_number, is_active, sort_order,
    'success', created_at, 'migration-20260921', NULL, NULL, 0, NULL,
    created_at, updated_at
FROM weekly_digest_items
WHERE section = 'project';

-- community 原 0 条，此处省略；10 条 Skills 通过 admin API 在 Task 11 单独入库
```

- [ ] **Step 2：执行迁移 SQL**

执行：
```bash
mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse < V20260921__migrate_data.sql
```

Expected: 4 个 INSERT 全部成功（news 5 / paper 5 / project 4，community 0）。

- [ ] **Step 3：验证迁移条数**

执行：
```bash
mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse -e "
  SELECT 'news' AS sec, COUNT(*) FROM news_item
  UNION ALL SELECT 'paper', COUNT(*) FROM paper_item
  UNION ALL SELECT 'project', COUNT(*) FROM project_item
  UNION ALL SELECT 'community', COUNT(*) FROM community_item;
"
```

Expected: news=5, paper=5, project=4, community=0（与原 weekly_digest_items 一致）。

- [ ] **Step 4：Commit**

```bash
cd D:/IdeaProjects/skillpulse-api
git add src/main/resources/db/migration/V20260921__migrate_data.sql
git commit -m "feat(db): 14 条历史数据迁移到 4 张新表"
```

---

## Task 11：启动后端 + 验证公开 API 等价

**Files:**
- 无文件改动

- [ ] **Step 1：重启后端加载新代码**

执行：
```bash
# 找到旧 PID
netstat -ano | grep ":8081" | grep LISTEN | awk '{print $NF}'
# 杀掉
taskkill //PID {pid} //F
# 启动新
cd D:/IdeaProjects/skillpulse-api
mvn -q spring-boot:run -Dspring-boot.run.profiles=dev > /d/tmp/api-boot.log 2>&1 &
```

- [ ] **Step 2：等启动 + 健康检查**

执行：
```bash
sleep 30
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8081/api/weekly-digest/issues"
```

Expected: 200。

- [ ] **Step 3：验证公开 API 返回与原等价**

执行：
```bash
echo "=== section=news ==="
curl -s "http://localhost:8081/api/weekly-digest?section=news&limit=5" | head -c 200
echo
echo "=== section=paper ==="
curl -s "http://localhost:8081/api/weekly-digest?section=paper&limit=5" | head -c 200
echo
echo "=== section=project ==="
curl -s "http://localhost:8081/api/weekly-digest?section=project&limit=5" | head -c 200
echo
echo "=== issues ==="
curl -s "http://localhost:8081/api/weekly-digest/issues"
echo
echo "=== search OpenAI ==="
curl -s "http://localhost:8081/api/weekly-digest/search?q=OpenAI" | head -c 300
```

Expected:
- news 返回 5 条
- paper 返回 5 条
- project 返回 4 条
- issues 返回 [108]
- search 返回 3 条 OpenAI

- [ ] **Step 4：验证 id 前缀路由**

执行：
```bash
NEWS_ID=$(curl -s "http://localhost:8081/api/weekly-digest?section=news&limit=1" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")
echo "id=$NEWS_ID"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8081/api/weekly-digest/$NEWS_ID"
```

Expected: HTTP 200，且 id 以 "news-" 开头。

- [ ] **Step 5：Commit（如有修改）**

如无修改，跳过此步。

---

## Task 12：Skills 数据通过 admin API 入库

**Files:**
- Create: `D:\tmp\seed-skills.json`（临时 JSON payload）

- [ ] **Step 1：写 Skills 批量入库 JSON payload**

`D:\tmp\seed-skills.json`：

```json
{
  "issueNumber": 108,
  "items": [
    {
      "section": "community",
      "title": "Claude Code Skills：让 AI 代理拥有持久化记忆与跨会话能力",
      "summary": "Anthropic 推出的 Claude Code Skills 机制，允许开发者将工具调用约定、行为约束写入 Skills 文件，AI 代理可跨会话复用，大幅提升生产力。",
      "url": "https://docs.claude.com/en/docs/claude-code/skills",
      "source": "Anthropic",
      "sourceId": "claude-code-skills",
      "stars": 8420,
      "commentsCount": 312,
      "likesCount": 1280,
      "publishedDate": "2026-09-08",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Smithery：聚合 12000+ MCP Skills 的统一市场",
      "summary": "Smithery 提供 MCP Skills 发现、安装、评分一体化平台，支持一键将 Skills 接入 Claude Desktop / Cursor / Cline。",
      "url": "https://smithery.ai/skills",
      "source": "Smithery",
      "sourceId": "smithery-marketplace",
      "stars": 3150,
      "commentsCount": 89,
      "likesCount": 420,
      "publishedDate": "2026-09-07",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Cline 3.4 发布：内置 Agent Skills 自动加载机制",
      "summary": "Cline 在 3.4 版本中引入 Skills 自动发现协议，可在打开项目时自动加载 .cline/skills 下的预设能力，减少重复 prompt。",
      "url": "https://github.com/cline/cline/releases/tag/v3.4.0",
      "source": "GitHub",
      "sourceId": "cline-3.4",
      "stars": 5120,
      "commentsCount": 156,
      "likesCount": 740,
      "publishedDate": "2026-09-06",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "LobeHub Skills Hub：中文社区最活跃的 AI Skills 评测库",
      "summary": "LobeHub 维护的 Skills Hub 收录了 800+ 经过中文用户实测的 Skills，每条带教程视频、可信度评级。",
      "url": "https://lobehub.com/zh/skills",
      "source": "LobeHub",
      "sourceId": "lobehub-skills",
      "stars": 2890,
      "commentsCount": 201,
      "likesCount": 633,
      "publishedDate": "2026-09-05",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "MCP 协议正式进入 1.0 稳定版",
      "summary": "Model Context Protocol 1.0 锁定核心 API，Skills 注册中心 / 鉴权 / 流式传输三大规范冻结，向后兼容性长期支持。",
      "url": "https://modelcontextprotocol.io/specification/2025-06-18",
      "source": "MCP",
      "sourceId": "mcp-1.0",
      "stars": 15400,
      "commentsCount": 502,
      "likesCount": 2200,
      "publishedDate": "2026-09-04",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Aider Skills：结对编程场景下的代码片段复用",
      "summary": "Aider 新增 Skills 模块，将高频代码模板（CRUD、迁移、测试）封装为可调用 Skills，让 AI 自动补全上下文。",
      "url": "https://aider.chat/2025/skills.html",
      "source": "Aider",
      "sourceId": "aider-skills",
      "stars": 1820,
      "commentsCount": 67,
      "likesCount": 290,
      "publishedDate": "2026-09-03",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Continue 开源 Agent Skills Marketplace",
      "summary": "Continue.dev 上线社区驱动 Skills 市场，所有 Skills 均带签名校验与社区评分，避免恶意注入。",
      "url": "https://marketplace.continue.dev/",
      "source": "Continue",
      "sourceId": "continue-marketplace",
      "stars": 1240,
      "commentsCount": 45,
      "likesCount": 178,
      "publishedDate": "2026-09-02",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Windsurf Skills：基于工作流的自动化能力组合",
      "summary": "Codeium 的 Windsurf 编辑器推出 Skills Chain，可将多个原子 Skills 串成工作流，一键执行复杂任务。",
      "url": "https://codeium.com/windsurf/skills",
      "source": "Codeium",
      "sourceId": "windsurf-skills",
      "stars": 980,
      "commentsCount": 34,
      "likesCount": 156,
      "publishedDate": "2026-09-01",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Roo Code Skills 框架：让任意 IDE 拥有 Skills 能力",
      "summary": "Roo Code 开源 Skills 运行时框架，可嵌入 VS Code / JetBrains / Vim，让任何编辑器都能调用 Anthropic / OpenAI 的 Skills。",
      "url": "https://github.com/RooCodeInc/Roo-Code/skills",
      "source": "GitHub",
      "sourceId": "roo-code-skills",
      "stars": 670,
      "commentsCount": 28,
      "likesCount": 95,
      "publishedDate": "2026-08-31",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    },
    {
      "section": "community",
      "title": "Zed 编辑器加入 Skills 生态：极简高性能方案",
      "summary": "Zed 与 Anthropic 合作推出原生 Skills 支持，延迟低于 50ms，适合对响应速度有要求的开发者。",
      "url": "https://zed.dev/blog/skills",
      "source": "Zed",
      "sourceId": "zed-skills",
      "stars": 540,
      "commentsCount": 21,
      "likesCount": 78,
      "publishedDate": "2026-08-30",
      "fetchStatus": "success",
      "batchId": "skills-mock-20260921"
    }
  ]
}
```

- [ ] **Step 2：登录 admin 获取 token**

执行：
```bash
TOKEN=$(curl -s -X POST "http://localhost:8081/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['token'])")
echo "token=${TOKEN:0:20}..."
```

Expected: 拿到 token（不报错）。

- [ ] **Step 3：调新端点 POST /api/admin/weekly-digest/community/items/batch 入库**

执行：
```bash
curl -s -X POST "http://localhost:8081/api/admin/weekly-digest/community/items/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @D:/tmp/seed-skills.json
```

Expected: `{"success":true,"data":{"inserted":10,"skippedDuplicate":0,"errors":[]}}`。

- [ ] **Step 4：验证 Skills 公开 API**

执行：
```bash
curl -s "http://localhost:8081/api/weekly-digest?section=community&limit=20" | python -c "
import json,sys
data = json.load(sys.stdin)
print(f'条数={len(data[\"data\"])}')
for item in data['data'][:3]:
    print(f'  - {item[\"id\"]} | {item[\"title\"][:40]}')
"
```

Expected: 条数=10，id 以 "community-" 开头。

- [ ] **Step 5：清理临时文件**

执行：`rm D:/tmp/seed-skills.json`

---

## Task 13：删除前端 mock，改造 WeeklyTimeline 走真实后端

**Files:**
- Modify: `D:\WebstormProjects\skillpulse-chestnut\src\components\WeeklyTimeline.tsx`
- Delete: `D:\WebstormProjects\skillpulse-chestnut\src\lib\mock-data.ts`

- [ ] **Step 1：改造 WeeklyTimeline 移除 mock 注入**

`D:\WebstormProjects\skillpulse-chestnut\src\components\WeeklyTimeline.tsx` 修改：

- 删 import: `import { MOCK_SKILL_AGENT_ITEMS } from "@/lib/mock-data";`
- 删常量: `const BACKEND_SECTIONS: WeeklyDigestSection[] = ["news", "paper", "project", "community"];`（改为 4 个全走后端）
- 修改 `BACKEND_SECTIONS` 为：`["news", "paper", "project", "community"]`
- 改 `setAllItems([...MOCK_SKILL_AGENT_ITEMS, ...backend])` 为：`setAllItems(backend)`
- 改 `loadByIssue` 中同样：`setAllItems([...MOCK_SKILL_AGENT_ITEMS, ...backend])` → `setAllItems(backend)`
- 改 doc comment 移除 mock 相关字样

- [ ] **Step 2：编译验证**

执行：`cd D:/WebstormProjects/skillpulse-chestnut && npx tsc --noEmit`

Expected: 0 错误。

- [ ] **Step 3：跑 vitest 验证**

执行：`cd D:/WebstormProjects/skillpulse-chestnut && npx vitest run`

Expected: 20 测试用例全部通过。

- [ ] **Step 4：删除 mock-data.ts 文件**

执行：`rm D:/WebstormProjects/skillpulse-chestnut/src/lib/mock-data.ts`

- [ ] **Step 5：浏览器验证时间线显示 community Skills**

操作：在浏览器打开 http://localhost:3000/ → 应看到全部 24 条（5 news + 5 paper + 4 project + 10 community）。

- [ ] **Step 6：Commit**

```bash
cd D:/WebstormProjects/skillpulse-chestnut
git add src/components/WeeklyTimeline.tsx
git rm src/lib/mock-data.ts
git commit -m "refactor(frontend): WeeklyTimeline 移除 mock 注入，4 栏目全走后端"
```

---

## Task 14：前端 type 加 metadata 字段（可选，本期可不做）

**Files:**
- Modify: `D:\WebstormProjects\skillpulse-chestnut\src\types\weekly-digest.ts`

> 注：当前前端不展示 metadata，可延后。需要时按 spec §3.2 加。

**本期跳过**，留作后续 PR。在 docs/superpowers/specs/2026-09-21-section-tables-design.md §11「后续步骤」中已有提及。

---

## Task 15：端到端验证（spec §10 验证清单）

**Files:**
- 无文件改动

- [ ] **Step 1：跑完整 spec §10 验证清单**

执行：
```bash
echo "=== 1. 4 张表 DDL 已建 ==="
mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse -e "SHOW TABLES LIKE '%_item'"

echo "=== 2. 14 条历史 + 10 条 Skills ==="
mysql -h 127.0.0.1 -P 3307 -uroot -p123456 skillpulse -e "
SELECT 'news' AS sec, COUNT(*) AS n FROM news_item
UNION ALL SELECT 'paper', COUNT(*) FROM paper_item
UNION ALL SELECT 'project', COUNT(*) FROM project_item
UNION ALL SELECT 'community', COUNT(*) FROM community_item;"

echo "=== 3. section=news ==="
curl -s "http://localhost:8081/api/weekly-digest?section=news" | python -c "import json,sys;print(len(json.load(sys.stdin)['data']))"

echo "=== 4. issues ==="
curl -s "http://localhost:8081/api/weekly-digest/issues"

echo "=== 5. search OpenAI ==="
curl -s "http://localhost:8081/api/weekly-digest/search?q=OpenAI" | python -c "import json,sys;d=json.load(sys.stdin);print(f'titles: {len(d[\"data\"])}')"

echo "=== 6. id 前缀 ==="
NEWS_ID=$(curl -s "http://localhost:8081/api/weekly-digest?section=news&limit=1" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")
echo "id=$NEWS_ID"

echo "=== 7. Vitest ==="
cd D:/WebstormProjects/skillpulse-chestnut && npx vitest run 2>&1 | tail -5

echo "=== 8. tsc ==="
npx tsc --noEmit 2>&1 | head -5
```

Expected:
- 4 张表都存在
- 14 + 10 = 24 条数据
- section=news 返回 5
- issues 返回 [108]
- search OpenAI 返回 3
- id 以 news- 开头
- Vitest 20 通过
- tsc 0 错误

- [ ] **Step 2：浏览器最终验证**

操作：刷新 http://localhost:3000/，确认：
- 时间线展示 24 条（之前是 14 + mock，现在全后端）
- 切换 Tab 全部正常
- 搜索 OpenAI 返回 3 条
- 主题切换 3 档正常

- [ ] **Step 3：Commit（如有验证脚本修改）**

如无，跳过。

---

## Self-Review

**1. Spec 覆盖**：
- §3 字段设计 → Task 1（DDL）+ Task 2（Entity）+ Task 3（Mapper）+ Task 4（DTO）
- §4 索引 → Task 1（DDL 中含 5 索引）
- §5.1 natural key → Task 1（uk_natural_key）+ Task 3（selectIdByNaturalKey）
- §5.2 fetch_status 状态机 → Task 3（fetchStatus 字段）+ Task 4（DTO 接收）
- §5.3 重试策略 → Task 3（retryCount 字段）
- §6.1 公开 API 路径不变 → Task 7（WeeklyDigestController 保持）
- §6.2 id 前缀路由 → Task 5（extractSection）+ Task 11 Step 4 验证
- §7 Admin 24 端点 → Task 9（SectionAdminController）
- §8 迁移方案 → Task 10（V20260921__migrate_data.sql）+ Task 12（Skills 入库）
- §9 风险缓解 → Task 5（validateSection）+ Task 1（保留旧表）
- §10 验证清单 → Task 15

**2. Placeholder 扫描**：grep "TODO|TBD|fill in|类似" → 无。

**3. 类型一致性**：
- `WeeklyDigestItem` 作为统一 DTO，4 个 entity 通过 `WeeklyDigestItemSource` 接口对齐字段
- 所有 mapper 的 SQL 列别名与 entity getter 一致（如 `source_id AS sourceId` ↔ `getSourceId()`）
- `SectionService.create(section, item)` 与 `update(id, item)` 签名一致，前者按 section 路由，后者按 id 前缀路由
- 旧的 `AdminWeeklyDigestController` 与 `WeeklyDigestAdminController` 都委托给 `SectionService`，不再依赖 `WeeklyDigestItemService`（旧 service 在 Task 16 删除前仍保留）

**已知遗留**（不在本计划）：
- 旧的 `WeeklyDigestItemService` 与 `WeeklyDigestItemMapper` 文件在迁移期保留，新代码完全走 `SectionService`
- 删除旧 service / mapper / 旧表 `weekly_digest_items` 列入 Task 16（运维最终清理任务）
- `metadata` JSON 字段在前端暂未消费，spec §3.2 已定义；后端 mapper 没把 metadata 列映射到 entity（保持简单，前端不需要），后续按需扩展
