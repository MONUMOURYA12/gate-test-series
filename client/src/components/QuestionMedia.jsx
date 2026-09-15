import { useState } from "react";
import { questionMediaUrl } from "../services/api";
import "./question-media.css";

export default function QuestionMedia({ images = [] }) {
  const [failed, setFailed] = useState(false);
  if (!images.length) return null;
  return <div className="question-media">
    {failed && <p role="alert">The question image could not load. Refresh before answering.</p>}
    {images.map((image, index) => <a key={image.url} href={questionMediaUrl(image.url)} target="_blank" rel="noreferrer" title="Open question image at full size">
      <img src={questionMediaUrl(image.url)} width={image.width} height={image.height}
        alt={`Original question and diagrams, part ${index + 1}`} onError={() => setFailed(true)} />
    </a>)}
  </div>;
}
