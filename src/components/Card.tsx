type CardProps = {
  title: string;
  subtitle?: string;
};
function Card({ title, subtitle }: CardProps) {
  return (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
    </div>
  );
}

export default Card;
