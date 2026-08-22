import { WritingCriterion, BandDescriptor } from "./types";

/**
 * Official IELTS Public Band Descriptors for Writing Task 1 & Task 2
 * Mapped for Band 0.0 - 9.0 (with half-band interpolations)
 */

export const IELTS_BAND_DESCRIPTORS: Record<
  WritingCriterion,
  Record<number, BandDescriptor>
> = {
  TASK_ACHIEVEMENT: {
    9: {
      band: 9,
      summary: "Hoàn thành xuất sắc và toàn diện mọi yêu cầu đề bài",
      detail:
        "Fully addresses all parts of the task. Presents a fully developed position in answer to the question with relevant, fully extended and well supported ideas.",
      bulletPoints: [
        "Trả lời trọn vẹn mọi yêu cầu của đề bài.",
        "Quan điểm rõ ràng, phát triển lập luận sâu sắc.",
        "Dẫn chứng và luận cứ thuyết phục, hoàn chỉnh.",
      ],
    },
    8: {
      band: 8,
      summary: "Đáp ứng đầy đủ yêu cầu đề bài với lập luận phát triển tốt",
      detail:
        "Sufficiently addresses all parts of the task. Presents a well-developed response to the question with relevant, extended and supported ideas.",
      bulletPoints: [
        "Bao quát đầy đủ các phần của đề bài.",
        "Phát triển ý tưởng rõ ràng, có dẫn chứng cụ thể.",
        "Đôi khi có thể có một vài chi tiết nhỏ chưa hoàn hảo.",
      ],
    },
    7: {
      band: 7,
      summary: "Bao quát toàn bộ yêu cầu, quan điểm rõ ràng xuyên suốt",
      detail:
        "Addresses all parts of the task. Presents a clear position throughout the response. Presents, extends and supports main ideas, but there may be a tendency to over-generalise.",
      bulletPoints: [
        "Trả lời tất cả các yêu cầu chính.",
        "Quan điểm rõ ràng từ đầu đến cuối bài.",
        "Các ý chính được giải thích nhưng có thể hơi tổng quát hóa.",
      ],
    },
    6: {
      band: 6,
      summary: "Bao quát các yêu cầu chính, lập luận có thể còn chưa sâu",
      detail:
        "Addresses all parts of the task although some parts may be more fully covered than others. Presents a relevant position although conclusions may become unclear or repetitive.",
      bulletPoints: [
        "Đã đề cập đến các yêu cầu cơ bản.",
        "Quan điểm nhìn chung rõ ràng dù phần kết luận có thể lặp ý.",
        "Một số ý chính chưa được mở rộng hoặc dẫn chứng đầy đủ.",
      ],
    },
    5: {
      band: 5,
      summary: "Đáp ứng một phần đề bài, phát triển ý chưa hoàn chỉnh",
      detail:
        "Addresses the task only partially; the format may be inappropriate in places. Expresses a position but the development is not always clear and there may be no conclusions drawn.",
      bulletPoints: [
        "Chỉ giải quyết được một phần đề bài.",
        "Quan điểm chưa phát triển rõ ràng hoặc thiếu kết luận.",
        "Có thể đưa ra ý nhưng thiếu giải thích chi tiết.",
      ],
    },
    4: {
      band: 4,
      summary: "Chỉ giải quyết sơ lược, ý tưởng hạn chế hoặc lạc đề",
      detail:
        "Responds to the task only in a minimal way or the answer is tangential, possibly largely irrelevant. Presents a position but this is unclear.",
      bulletPoints: [
        "Nội dung sơ sài hoặc có phần lạc đề.",
        "Quan điểm không rõ ràng hoặc gây hiểu nhầm.",
      ],
    },
    3: {
      band: 3,
      summary: "Không giải quyết được yêu cầu cơ bản của bài",
      detail:
        "Does not adequately address any part of the task. Does not express a clear position.",
      bulletPoints: ["Ý tưởng mờ nhạt, không đúng trọng tâm đề bài."],
    },
    2: {
      band: 2,
      summary: "Nội dung gần như không liên quan đến đề bài",
      detail:
        "Barely responds to the task, does not express a position, may attempt to copy the prompt.",
      bulletPoints: ["Sao chép đề hoặc viết nội dung không ăn nhập."],
    },
    1: {
      band: 1,
      summary: "Không hoàn thành bài viết hoặc chỉ viết vài từ",
      detail: "Answer is completely unrelated to the task.",
      bulletPoints: ["Không có khả năng truyền đạt thông điệp."],
    },
    0: {
      band: 0,
      summary: "Không làm bài hoặc bài viết trắng",
      detail: "Did not attempt the task in any way.",
      bulletPoints: ["Bỏ trắng hoặc không nộp bài."],
    },
  },
  COHERENCE_COHESION: {
    9: {
      band: 9,
      summary: "Mạch lạc hoàn hảo, liên kết tự nhiên không gượng ép",
      detail:
        "Uses cohesion in such a way that it attracts no attention. Skillfully manages paragraphing.",
      bulletPoints: [
        "Chuyển ý mượt mà và tự nhiên tuyệt đối.",
        "Phân đoạn bài viết mẫu mực, logic.",
        "Không lạm dụng từ nối cơ học.",
      ],
    },
    8: {
      band: 8,
      summary: "Sắp xếp thông tin logic, liên kết ý tưởng nhuần nhuyễn",
      detail:
        "Sequences information and ideas logically. Manages all aspects of cohesion well. Uses paragraphing sufficiently and appropriately.",
      bulletPoints: [
        "Mạch ý rõ ràng, chuyển tiếp tự nhiên giữa các câu.",
        "Sử dụng đại từ thay thế và từ nối đa dạng.",
        "Bố cục các đoạn văn mạch lạc.",
      ],
    },
    7: {
      band: 7,
      summary: "Bố cục logic, sử dụng linh hoạt các phương tiện liên kết",
      detail:
        "Logically organises information and ideas; there is clear progression throughout. Uses a range of cohesive devices appropriately although there may be some under-/over-use.",
      bulletPoints: [
        "Mạch bài có sự phát triển liên tục, dễ theo dõi.",
        "Sử dụng tốt từ nối dù đôi chỗ có thể hơi cứng hoặc lạm dụng.",
        "Mỗi đoạn có một chủ đề rõ ràng.",
      ],
    },
    6: {
      band: 6,
      summary: "Có bố cục tổng thể, liên kết giữa các câu đôi chỗ còn cơ học",
      detail:
        "Arranges information and ideas coherently and there is a clear overall progression. Uses cohesive devices effectively, but cohesion within and/or between sentences may be faulty or mechanical.",
      bulletPoints: [
        "Bài viết có bố cục và mạch phát triển chung.",
        "Từ nối đôi khi dùng cơ học hoặc thiếu chính xác.",
        "Đại từ quy chiếu đôi khi chưa rõ ràng.",
      ],
    },
    5: {
      band: 5,
      summary: "Liên kết ý còn yếu, phân đoạn chưa hợp lý",
      detail:
        "Presents information with some organisation but there may be a lack of overall progression. Makes inadequate, inaccurate or over-use of cohesive devices.",
      bulletPoints: [
        "Thông tin có tổ chức nhưng thiếu tính liên tục xuyên suốt.",
        "Lạm dụng từ nối đơn giản (And, But, So, Then, Also).",
        "Phân đoạn thiếu logic.",
      ],
    },
    4: {
      band: 4,
      summary: "Mạch ý rời rạc, khó theo dõi liên kết giữa các câu",
      detail:
        "Presents information and ideas but these are not arranged coherently and there is no clear progression in the response.",
      bulletPoints: ["Câu văn rời rạc, không tạo được đoạn văn hoàn chỉnh."],
    },
    3: {
      band: 3,
      summary: "Không có sự liên kết logic giữa các phần",
      detail: "Does not organise ideas logically. May be difficult to follow.",
      bulletPoints: ["Không thể nắm bắt được tiến trình lập luận."],
    },
    2: {
      band: 2,
      summary: "Hoàn toàn thiếu tính kết nối",
      detail: "Little or no evidence of cohesive devices or logical sequence.",
      bulletPoints: ["Từ ngữ chắp vá, không có liên kết."],
    },
    1: {
      band: 1,
      summary: "Không có liên kết",
      detail: "Fails to communicate any message.",
      bulletPoints: ["Không tạo được nghĩa."],
    },
    0: {
      band: 0,
      summary: "Không làm bài",
      detail: "Did not attempt the task.",
      bulletPoints: ["Không có bài nộp."],
    },
  },
  LEXICAL_RESOURCE: {
    9: {
      band: 9,
      summary: "Vốn từ vựng sâu rộng, sử dụng chuẩn xác và tinh tế",
      detail:
        "Uses a wide range of vocabulary with very natural and sophisticated control of lexical features; rare minor errors occur only as 'slips'.",
      bulletPoints: [
        "Vốn từ phong phú, tự nhiên và chuẩn xác.",
        "Sử dụng collocation và thành ngữ tinh tế.",
        "Gần như không có bất kỳ lỗi chính tả hoặc dùng từ nào.",
      ],
    },
    8: {
      band: 8,
      summary: "Từ vựng phong phú, sử dụng linh hoạt các cụm từ nâng cao",
      detail:
        "Fluently and flexibly uses a wide range of vocabulary to convey precise meanings. Skilfully uses uncommon lexical items, but there may be occasional inaccuracies in word choice and collocation.",
      bulletPoints: [
        "Diễn đạt ý nghĩa chính xác bằng từ vựng đa dạng.",
        "Sử dụng tốt từ ngữ ít phổ biến (uncommon vocabulary).",
        "Chỉ mắc một vài lỗi nhỏ về collocation hoặc chính tả.",
      ],
    },
    7: {
      band: 7,
      summary:
        "Vốn từ đủ để thể hiện ý tưởng linh hoạt, biết dùng collocations",
      detail:
        "Uses a sufficient range of vocabulary to allow some flexibility and precision. Uses less common lexical items with some awareness of style and collocation.",
      bulletPoints: [
        "Vốn từ đủ rộng để diễn đạt linh hoạt.",
        "Có ý thức chọn từ vựng học thuật và collocations.",
        "Vẫn có một số lỗi chọn từ, tạo dạng từ hoặc chính tả nhưng không cản trở hiểu.",
      ],
    },
    6: {
      band: 6,
      summary: "Vốn từ đủ dùng cho đề bài, đôi chỗ lặp từ hoặc dùng chưa chuẩn",
      detail:
        "Uses an adequate range of vocabulary for the task. Attempts to use less common vocabulary but with some inaccuracy. Makes some errors in spelling and/or word formation.",
      bulletPoints: [
        "Từ vựng cơ bản đầy đủ nhưng còn lặp lại.",
        "Cố gắng dùng từ vựng nâng cao nhưng chưa thật sự chính xác.",
        "Có lỗi chính tả và dạng từ nhưng người đọc vẫn hiểu được.",
      ],
    },
    5: {
      band: 5,
      summary: "Vốn từ hạn chế, lỗi từ vựng và chính tả gây chú ý",
      detail:
        "Uses a limited range of vocabulary, but this is minimally adequate for the task. May make noticeable errors in spelling and/or word formation that may cause some difficulty for the reader.",
      bulletPoints: [
        "Vốn từ cơ bản, ít từ vựng học thuật.",
        "Nhiều lỗi chính tả hoặc dùng sai dạng từ.",
        "Đôi chỗ gây khó khăn cho người đọc.",
      ],
    },
    4: {
      band: 4,
      summary: "Từ vựng rất cơ bản, lỗi thường xuyên cản trở giao tiếp",
      detail:
        "Uses only basic vocabulary which may be used repetitively or which may be inappropriate for the task. Has limited control of word formation and/or spelling.",
      bulletPoints: [
        "Chỉ dùng được các từ vựng rất đơn giản.",
        "Lỗi chính tả và ngữ nghĩa xuất hiện dày đặc.",
      ],
    },
    3: {
      band: 3,
      summary: "Vốn từ cực kỳ hạn chế",
      detail:
        "Uses only a very limited range of words and expressions with very limited control of word formation and/or spelling.",
      bulletPoints: ["Không diễn đạt được ý trọn vẹn."],
    },
    2: {
      band: 2,
      summary: "Chỉ biết các từ đơn lẻ",
      detail: "Extremely limited vocabulary; essentially no control of words.",
      bulletPoints: ["Từ ngữ rời rạc, chắp vá."],
    },
    1: {
      band: 1,
      summary: "Từ vựng không thể hiện được nội dung",
      detail: "Cannot use words to express meaning.",
      bulletPoints: ["Không có khả năng sử dụng từ."],
    },
    0: {
      band: 0,
      summary: "Không làm bài",
      detail: "Did not attempt the task.",
      bulletPoints: ["Không có bài nộp."],
    },
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    9: {
      band: 9,
      summary: "Cấu trúc câu phong phú và chuẩn xác tuyệt đối",
      detail:
        "Uses a wide range of structures with full flexibility and accuracy; rare minor errors occur only as 'slips'.",
      bulletPoints: [
        "Sử dụng linh hoạt và hoàn hảo các cấu trúc câu phức.",
        "Độ chính xác ngữ pháp tuyệt đối.",
        "Dấu câu chuẩn xác hoàn toàn.",
      ],
    },
    8: {
      band: 8,
      summary: "Đa dạng cấu trúc câu, hầu hết các câu đều không có lỗi",
      detail:
        "Uses a wide range of structures. The majority of sentences are error-free. Makes only very occasional errors or non-systematic faults.",
      bulletPoints: [
        "Đa dạng cấu trúc câu ghép và câu phức.",
        "Đa số câu văn hoàn toàn không có lỗi ngữ pháp.",
        "Thỉnh thoảng có lỗi nhỏ không đáng kể.",
      ],
    },
    7: {
      band: 7,
      summary: "Sử dụng nhiều cấu trúc phức, kiểm soát tốt ngữ pháp và dấu câu",
      detail:
        "Uses a variety of complex structures. Produces frequent error-free sentences. Has good control of grammar and punctuation but may make a few errors.",
      bulletPoints: [
        "Sử dụng thành thạo nhiều dạng câu phức.",
        "Có nhiều câu hoàn chỉnh không lỗi.",
        "Vẫn có một số lỗi ngữ pháp nhỏ nhưng không ảnh hưởng đến ý nghĩa.",
      ],
    },
    6: {
      band: 6,
      summary: "Kết hợp câu đơn và câu phức, có một số lỗi ngữ pháp",
      detail:
        "Uses a mix of simple and complex sentence forms. Makes some errors in grammar and punctuation but they rarely reduce communication.",
      bulletPoints: [
        "Kết hợp cả câu đơn và câu phức trong bài.",
        "Có lỗi ngữ pháp và dấu câu nhưng vẫn hiểu được.",
        "Câu phức đôi khi cấu trúc chưa chuẩn.",
      ],
    },
    5: {
      band: 5,
      summary:
        "Cấu trúc câu đơn giản chiếm ưu thế, lỗi ngữ pháp xuất hiện nhiều",
      detail:
        "Uses only a limited range of structures. Attempts complex sentences but these tend to be less accurate than simple sentences. May make frequent grammatical errors and punctuation may be faulty.",
      bulletPoints: [
        "Chủ yếu dùng câu đơn, câu phức thường xuyên sai lỗi.",
        "Lỗi thì động từ, hòa hợp chủ vị, mạo từ xuất hiện thường xuyên.",
        "Dấu câu chưa chuẩn.",
      ],
    },
    4: {
      band: 4,
      summary: "Cấu trúc câu rất hạn chế, lỗi ngữ pháp cản trở giao tiếp",
      detail:
        "Uses only a very limited range of structures with only rare use of subordinate clauses. Some structures are accurate but errors predominate, and punctuation is often faulty.",
      bulletPoints: [
        "Hầu như không viết được câu phức đúng.",
        "Lỗi ngữ pháp chiếm đa số các câu.",
      ],
    },
    3: {
      band: 3,
      summary: "Không kiểm soát được cấu trúc câu cơ bản",
      detail:
        "Attempts sentence forms, but errors in grammar and punctuation predominate and distort the meaning.",
      bulletPoints: ["Lỗi ngữ pháp làm biến dạng ý nghĩa của câu."],
    },
    2: {
      band: 2,
      summary: "Không thể tạo thành câu hoàn chỉnh",
      detail: "Cannot produce basic sentence forms.",
      bulletPoints: ["Không có cấu trúc câu đúng."],
    },
    1: {
      band: 1,
      summary: "Không có ngữ pháp",
      detail: "Fails to produce recognizable grammatical structures.",
      bulletPoints: ["Không có câu hoàn chỉnh."],
    },
    0: {
      band: 0,
      summary: "Không làm bài",
      detail: "Did not attempt the task.",
      bulletPoints: ["Không có bài nộp."],
    },
  },
};

/**
 * Helper to get descriptor for a given band score (including half bands like 6.5 -> falls back to base 6 or interpolated summary)
 */
export function getBandDescriptor(
  criterion: WritingCriterion,
  bandScore: number
): BandDescriptor {
  const table = IELTS_BAND_DESCRIPTORS[criterion];
  const roundedBand = Math.round(bandScore);
  const baseDescriptor = table[roundedBand] || table[6];

  // For half band (e.g. 6.5), provide a balanced summary
  if (bandScore % 1 !== 0) {
    const floorBand = Math.floor(bandScore);
    const ceilBand = Math.ceil(bandScore);
    const floorDesc = table[floorBand];
    const ceilDesc = table[ceilBand];

    return {
      band: bandScore,
      summary: `Mức chuyển tiếp giữa Band ${floorBand} và Band ${ceilBand} (${baseDescriptor.summary})`,
      detail: `Performance exhibits features between Band ${floorBand} (${floorDesc?.summary || ""}) and Band ${ceilBand} (${ceilDesc?.summary || ""}).`,
      bulletPoints: [
        `Đáp ứng vững chắc các tiêu chí của Band ${floorBand}.`,
        `Đang phát triển và tiệm cận các đặc điểm của Band ${ceilBand}.`,
        ...(baseDescriptor.bulletPoints || []),
      ],
    };
  }

  return baseDescriptor;
}
